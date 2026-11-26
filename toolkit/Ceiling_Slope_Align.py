# -*- coding: utf-8 -*-
"""
Ceiling Stack & Slope Align (Modeless Window)
Вирівнює верхній сілінг (або підлогу/дах) так, щоб він ліг впритул зверху на нижній ("пирогом"),
автоматично повторюючи його кут та напрямок нахилу (Slope) і враховуючи товщину та скетч.
Сумісний з pyRevit та RevitPythonShell (Revit 2020 - 2026).
"""

import math
import traceback
import ctypes
import clr

clr.AddReference("RevitAPI")
clr.AddReference("RevitAPIUI")
clr.AddReference("PresentationFramework")
clr.AddReference("PresentationCore")
clr.AddReference("WindowsBase")
clr.AddReference("System.Xml")

from System.IO import StringReader
from System.Xml import XmlReader
from System.Windows.Markup import XamlReader
from System.Windows.Interop import WindowInteropHelper
from System.Windows.Media import SolidColorBrush, Color

import Autodesk.Revit.DB as DB
from Autodesk.Revit.DB import (
    BuiltInCategory,
    BuiltInParameter,
    ElementId,
    Line,
    Options,
    PlanarFace,
    Solid,
    Transaction,
    XYZ,
)
from Autodesk.Revit.UI import ExternalEvent, ExternalEventRequest, IExternalEventHandler
from Autodesk.Revit.UI.Selection import ISelectionFilter, ObjectType
from Autodesk.Revit.Exceptions import OperationCanceledException


uiapp = __revit__

# Дозволяємо вибирати як Ceiling, так і Floor / Roof (на випадок якщо один із шарів змодельований ними)
VALID_BIC_IDS = set([
    int(BuiltInCategory.OST_Ceilings),
    int(BuiltInCategory.OST_Floors),
    int(BuiltInCategory.OST_Roofs),
])


def get_id_val(eid):
    if eid is None:
        return -1
    return int(eid.Value) if hasattr(eid, "Value") else int(eid.IntegerValue)


def is_valid_slab(el):
    if el is None or el.Category is None:
        return False
    if get_id_val(el.Category.Id) in VALID_BIC_IDS:
        return True
    if isinstance(el, (DB.Ceiling, DB.Floor, DB.RoofBase)):
        return True
    return False


class SlabSelectionFilter(ISelectionFilter):
    def AllowElement(self, elem):
        return is_valid_slab(elem)

    def AllowReference(self, reference, position):
        return True


def focus_revit_window(app):
    """Передає фокус головному вікну Revit, щоб PickObject одразу реагував на клік миші."""
    try:
        hwnd = app.MainWindowHandle
        if hwnd:
            ctypes.windll.user32.SetForegroundWindow(hwnd.ToInt64())
    except Exception:
        pass


def get_element_solids(el):
    solids = []
    opt = Options()
    opt.DetailLevel = DB.ViewDetailLevel.Fine
    opt.ComputeReferences = False
    geom = el.get_Geometry(opt)
    if not geom:
        return solids
    for g in geom:
        if isinstance(g, Solid) and g.Volume > 1e-6:
            solids.append(g)
        elif isinstance(g, DB.GeometryInstance):
            inst_geom = g.GetInstanceGeometry()
            if inst_geom:
                for ig in inst_geom:
                    if isinstance(ig, Solid) and ig.Volume > 1e-6:
                        solids.append(ig)
    return solids


def get_top_and_bottom_planar_faces(el):
    """
    Повертає (top_face, bottom_face) найбільшої площі серед PlanarFace елемента.
    """
    top_face = None
    top_area = -1.0
    bot_face = None
    bot_area = -1.0

    for solid in get_element_solids(el):
        for face in solid.Faces:
            if isinstance(face, PlanarFace):
                nz = face.FaceNormal.Z
                if nz > 0.15 and face.Area > top_area:
                    top_area = face.Area
                    top_face = face
                elif nz < -0.15 and face.Area > bot_area:
                    bot_area = face.Area
                    bot_face = face
    return top_face, bot_face


def get_mean_z(el):
    top_f, bot_f = get_top_and_bottom_planar_faces(el)
    if top_f is not None and bot_f is not None:
        return 0.5 * (top_f.Origin.Z + bot_f.Origin.Z)
    bb = el.get_BoundingBox(None)
    if bb:
        return 0.5 * (bb.Min.Z + bb.Max.Z)
    return get_height_offset(el)


def get_height_offset_param(el):
    for bip in (
        BuiltInParameter.CEILING_HEIGHTABOVELEVEL_PARAM,
        BuiltInParameter.FLOOR_HEIGHTABOVELEVEL_PARAM,
        BuiltInParameter.ROOF_LEVEL_OFFSET_PARAM,
    ):
        p = el.get_Parameter(bip)
        if p is not None:
            return p
    return None


def set_height_offset(el, new_offset):
    p = get_height_offset_param(el)
    if p and not p.IsReadOnly:
        p.Set(new_offset)
        return True
    return False


def get_height_offset(el):
    p = get_height_offset_param(el)
    return p.AsDouble() if p else 0.0


def get_sketch(doc, el):
    """
    Повертає елемент Sketch для Ceiling / Floor / Roof.
    """
    if hasattr(el, "SketchId"):
        sid = el.SketchId
        if sid and get_id_val(sid) > 0:
            sk = doc.GetElement(sid)
            if sk is not None:
                return sk

    if hasattr(el, "GetDependentElements"):
        try:
            dep_ids = el.GetDependentElements(DB.ElementClassFilter(DB.Sketch))
            for did in dep_ids:
                sk = doc.GetElement(did)
                if sk is not None:
                    return sk
        except Exception:
            pass

    base_id = get_id_val(el.Id)
    for delta in range(-15, 15):
        try:
            cid = ElementId(base_id + delta)
            cand = doc.GetElement(cid)
            if cand is not None and cand.GetType().Name == "Sketch":
                return cand
        except Exception:
            pass
    return None


def get_sketch_model_curves(doc, sketch):
    """Повертає всі ModelCurve, які належать цьому Sketch."""
    curves = []
    seen = set()

    if hasattr(sketch, "GetAllElements"):
        try:
            for eid in sketch.GetAllElements():
                el = doc.GetElement(eid)
                if isinstance(el, DB.ModelCurve):
                    iv = get_id_val(eid)
                    if iv not in seen:
                        seen.add(iv)
                        curves.append(el)
        except Exception:
            pass

    if not curves and hasattr(sketch, "GetDependentElements"):
        try:
            for eid in sketch.GetDependentElements(DB.ElementClassFilter(DB.CurveElement)):
                el = doc.GetElement(eid)
                if isinstance(el, DB.ModelCurve):
                    iv = get_id_val(eid)
                    if iv not in seen:
                        seen.add(iv)
                        curves.append(el)
        except Exception:
            pass
    return curves


def find_existing_slope_arrow(doc, sketch):
    """Шукає існуючу лінію Slope Arrow всередині Sketch."""
    if sketch is None:
        return None
    for mc in get_sketch_model_curves(doc, sketch):
        p = mc.get_Parameter(BuiltInParameter.SPECIFY_SLOPE_OR_OFFSET)
        if p is not None:
            return mc
    return None


def apply_slope_in_sketch(doc, upper_el, sketch, slope_dir_xy, slope_tan):
    """
    Модифікує скетч верхнього сілінга, задаючи нахил slope_tan у напрямку slope_dir_xy.
    Виконується всередині відкритої транзакції (або SketchEditScope).
    """
    is_sloped = abs(slope_tan) > 1e-6
    all_curves = get_sketch_model_curves(doc, sketch)
    slope_arrow = find_existing_slope_arrow(doc, sketch)

    boundary_curves = [
        mc for mc in all_curves
        if slope_arrow is None or get_id_val(mc.Id) != get_id_val(slope_arrow.Id)
    ]

    # Спочатку вимикаємо DefinesSlope на всіх звичайних лініях контуру
    for mc in boundary_curves:
        try:
            p_def = mc.get_Parameter(BuiltInParameter.ROOF_CURVE_IS_SLOPE_DEFINING)
            if p_def and not p_def.IsReadOnly and p_def.AsInteger() == 1:
                p_def.Set(0)
            elif hasattr(mc, "DefinesSlope") and mc.DefinesSlope:
                mc.DefinesSlope = False
        except Exception:
            pass

    if not is_sloped:
        if slope_arrow is not None:
            try:
                doc.Delete(slope_arrow.Id)
            except Exception:
                pass
        return True, u"Горизонтальний (0°)"

    sk_plane = sketch.SketchPlane
    plane_z = sk_plane.GetPlane().Origin.Z if sk_plane else 0.0

    # Обчислюємо центр контуру скетчу в XY
    pts = []
    for mc in boundary_curves:
        try:
            c = mc.GeometryCurve
            if c is not None:
                pts.append(c.GetEndPoint(0))
                pts.append(c.GetEndPoint(1))
        except Exception:
            pass

    if pts:
        cx = sum(p.X for p in pts) / float(len(pts))
        cy = sum(p.Y for p in pts) / float(len(pts))
    else:
        bb = upper_el.get_BoundingBox(None)
        cx = 0.5 * (bb.Min.X + bb.Max.X) if bb else 0.0
        cy = 0.5 * (bb.Min.Y + bb.Max.Y) if bb else 0.0

    p_tail = XYZ(cx, cy, plane_z)
    p_head = XYZ(cx + slope_dir_xy.X * 3.0, cy + slope_dir_xy.Y * 3.0, plane_z)
    arrow_line = Line.CreateBound(p_tail, p_head)

    if slope_arrow is not None:
        try:
            slope_arrow.GeometryCurve = arrow_line
        except Exception:
            try:
                doc.Delete(slope_arrow.Id)
            except Exception:
                pass
            slope_arrow = None

    if slope_arrow is None and hasattr(doc.Create, "NewSlopeArrow") and sk_plane is not None:
        try:
            slope_arrow = doc.Create.NewSlopeArrow(arrow_line, sk_plane)
        except Exception:
            slope_arrow = None

    if slope_arrow is not None:
        p_spec = slope_arrow.get_Parameter(BuiltInParameter.SPECIFY_SLOPE_OR_OFFSET)
        if p_spec and not p_spec.IsReadOnly:
            p_spec.Set(1)  # 1 = Specify: Slope

        for bip_h in (BuiltInParameter.SLOPE_START_HEIGHT, BuiltInParameter.ROOF_CURVE_HEIGHT_OFFSET):
            p_h = slope_arrow.get_Parameter(bip_h)
            if p_h and not p_h.IsReadOnly:
                try:
                    p_h.Set(0.0)
                except Exception:
                    pass

        p_slope = slope_arrow.get_Parameter(BuiltInParameter.ROOF_SLOPE)
        if p_slope and not p_slope.IsReadOnly:
            p_slope.Set(slope_tan)
        elif hasattr(slope_arrow, "Slope"):
            slope_arrow.Slope = slope_tan

        return True, u"Slope Arrow ({:.2f}°)".format(math.degrees(math.atan(abs(slope_tan))))

    # Fallback: якщо NewSlopeArrow не спрацював, використовуємо найбільш перпендикулярну лінію контуру
    best_mc = None
    best_dot = -1.0
    for mc in boundary_curves:
        crv = mc.GeometryCurve
        if isinstance(crv, Line):
            ldir = crv.Direction
            perp = XYZ(-ldir.Y, ldir.X, 0.0).Normalize()
            dot = abs(perp.DotProduct(slope_dir_xy))
            if dot > best_dot:
                best_dot = dot
                best_mc = mc

    if best_mc is not None:
        p_def = best_mc.get_Parameter(BuiltInParameter.ROOF_CURVE_IS_SLOPE_DEFINING)
        if p_def and not p_def.IsReadOnly:
            p_def.Set(1)
        elif hasattr(best_mc, "DefinesSlope"):
            best_mc.DefinesSlope = True

        p_sl = best_mc.get_Parameter(BuiltInParameter.ROOF_SLOPE)
        if p_sl and not p_sl.IsReadOnly:
            p_sl.Set(slope_tan)
        elif hasattr(best_mc, "Slope"):
            best_mc.Slope = slope_tan
        return True, u"По ребру ({:.2f}°)".format(math.degrees(math.atan(abs(slope_tan))))

    return False, u"Не вдалося задати нахил у скетчі."


class FailuresPreprocessor(DB.IFailuresPreprocessor):
    def PreprocessFailures(self, failuresAccessor):
        for f in failuresAccessor.GetFailureMessages():
            if f.GetSeverity() == DB.FailureSeverity.Warning:
                failuresAccessor.DeleteWarning(f)
        return DB.FailureProcessingResult.Continue


def run_sketch_slope_change(doc, upper_el, sketch, slope_dir_xy, slope_tan):
    """
    Виконує зміну нахилу скетчу: для Revit 2022+ використовує SketchEditScope,
    а для старіших версій — пряму транзакцію.
    """
    if hasattr(DB, "SketchEditScope") and sketch is not None:
        scope = DB.SketchEditScope(doc, u"Align Ceiling Slope")
        scope.Start(sketch.Id)
        t = Transaction(doc, u"Update Ceiling Slope")
        t.Start()
        try:
            ok, msg = apply_slope_in_sketch(doc, upper_el, sketch, slope_dir_xy, slope_tan)
            t.Commit()
            scope.Commit(FailuresPreprocessor())
            return ok, msg
        except Exception:
            if t.HasStarted() and not t.HasEnded():
                t.RollBack()
            if scope.IsActive:
                scope.Cancel()
            raise
    else:
        t = Transaction(doc, u"Update Ceiling Slope")
        t.Start()
        try:
            ok, msg = apply_slope_in_sketch(doc, upper_el, sketch, slope_dir_xy, slope_tan)
            doc.Regenerate()
            t.Commit()
            return ok, msg
        except Exception:
            if t.HasStarted() and not t.HasEnded():
                t.RollBack()
            raise


def align_upper_ceiling_to_lower(doc, lower_el, upper_el, extra_gap_mm=0.0):
    """
    Вирівнює верхній сілінг (upper_el) так, щоб його нижня грань лягла рівно
    на верхню грань нижнього сілінга (lower_el) з урахуванням нахилу (Slope) та додаткового зазору extra_gap_mm.
    """
    extra_gap_ft = extra_gap_mm / 304.8

    low_top_face, _ = get_top_and_bottom_planar_faces(lower_el)
    if low_top_face is None:
        raise ValueError(u"Не вдалося знайти верхню плоску грань нижнього елемента.")

    n = low_top_face.FaceNormal
    if n.Z < 0:
        n = n.Negate()
    p_low_top = low_top_face.Origin

    # Градієнт площини нижнього сілінга: dz/dx = -n.X / n.Z, dz/dy = -n.Y / n.Z
    grad_x = -n.X / n.Z
    grad_y = -n.Y / n.Z
    slope_tan = math.sqrt(grad_x * grad_x + grad_y * grad_y)

    if slope_tan > 1e-6:
        slope_dir_xy = XYZ(grad_x, grad_y, 0.0).Normalize()
    else:
        slope_dir_xy = XYZ(1.0, 0.0, 0.0)
        slope_tan = 0.0

    sketch = get_sketch(doc, upper_el)
    tg = DB.TransactionGroup(doc, u"Ceiling Stack & Slope Align")
    tg.Start()
    try:
        if sketch is not None:
            run_sketch_slope_change(doc, upper_el, sketch, slope_dir_xy, slope_tan)

            # Перевіряємо, чи нахил верхнього сілінга співпав за напрямком із нижнім
            _, up_bot_face = get_top_and_bottom_planar_faces(upper_el)
            if up_bot_face is not None and slope_tan > 1e-6:
                up_n = up_bot_face.FaceNormal
                if up_n.Z < 0:
                    up_n = up_n.Negate()
                if (up_n.X * n.X + up_n.Y * n.Y) < -1e-5:
                    run_sketch_slope_change(doc, upper_el, sketch, slope_dir_xy, -slope_tan)

        _, up_bot_face = get_top_and_bottom_planar_faces(upper_el)
        if up_bot_face is None:
            raise ValueError(u"Не вдалося отримати нижню грань верхнього сілінга після зміни нахилу.")

        # Вирівнюємо по висоті Z так, щоб нижня грань верхнього лягла точно на верхню грань нижнього
        bb_up = upper_el.get_BoundingBox(None)
        ref_x = 0.5 * (bb_up.Min.X + bb_up.Max.X) if bb_up else up_bot_face.Origin.X
        ref_y = 0.5 * (bb_up.Min.Y + bb_up.Max.Y) if bb_up else up_bot_face.Origin.Y

        z_target = p_low_top.Z - (n.X * (ref_x - p_low_top.X) + n.Y * (ref_y - p_low_top.Y)) / n.Z + extra_gap_ft

        n_up = up_bot_face.FaceNormal
        p_up_bot = up_bot_face.Origin
        z_current = p_up_bot.Z - (n_up.X * (ref_x - p_up_bot.X) + n_up.Y * (ref_y - p_up_bot.Y)) / n_up.Z

        delta_z = z_target - z_current

        t_off = Transaction(doc, u"Match Ceiling Height Offset")
        t_off.Start()
        try:
            cur_offset = get_height_offset(upper_el)
            if not set_height_offset(upper_el, cur_offset + delta_z):
                DB.ElementTransformUtils.MoveElement(doc, upper_el.Id, XYZ(0.0, 0.0, delta_z))
            doc.Regenerate()
            t_off.Commit()
        except Exception:
            if t_off.HasStarted() and not t_off.HasEnded():
                t_off.RollBack()
            raise

        tg.Assimilate()
        angle_deg = math.degrees(math.atan(slope_tan))
        return u"✓ Готово! Верхній сілінг ліг на нижній (кут: {:.2f}°, зсув Z: {:+.1f} мм)".format(
            angle_deg, delta_z * 304.8
        )
    except Exception:
        if tg.HasStarted():
            tg.RollBack()
        raise


class ExternalActionHandler(IExternalEventHandler):
    def __init__(self):
        self.queue = []
        self.window = None

    def Execute(self, app):
        q, self.queue = self.queue, []
        for act in q:
            try:
                act(app)
            except OperationCanceledException:
                if self.window:
                    self.window.set_status(u"Вибір скасовано (Esc).", is_error=False)
            except Exception as ex:
                if self.window:
                    self.window.set_status(u"Помилка: {}".format(ex), is_error=True)
                print(traceback.format_exc())

    def GetName(self):
        return "CeilingStackSlopeAlignHandler"


XAML_LAYOUT = u"""
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Ceiling Stack &amp; Slope Align"
        Width="375" SizeToContent="Height"
        WindowStartupLocation="CenterScreen"
        Topmost="True" ShowInTaskbar="False" WindowStyle="ToolWindow"
        ResizeMode="NoResize"
        Background="#F5F5F7"
        FontFamily="Segoe UI">
    <Border Padding="16">
        <StackPanel>
            <TextBlock Text="Вирівнювання сілінгів «Пирогом»"
                       FontSize="15" FontWeight="SemiBold" Foreground="#1C1C1E" Margin="0,0,0,4"/>
            <TextBlock Text="Кладе верхній сілінг впритул зверху на нижній із повторенням його нахилу (Slope)."
                       FontSize="12" Foreground="#6E6E73" TextWrapping="Wrap" Margin="0,0,0,12"/>

            <Border Background="#FFFFFF" CornerRadius="8" BorderBrush="#E5E5EA" BorderThickness="1" Padding="10" Margin="0,0,0,10">
                <StackPanel>
                    <DockPanel Margin="0,0,0,6">
                        <TextBlock Text="Нижній (база):" Width="95" VerticalAlignment="Center" FontSize="12" Foreground="#3A3A3C"/>
                        <Button x:Name="btnPickLower" Content="Вибрати" Width="75" Height="26" DockPanel.Dock="Right"
                                Background="#E9E9EE" BorderThickness="0" Cursor="Hand"/>
                        <TextBlock x:Name="lblLower" Text="Авто / Не вибрано" VerticalAlignment="Center"
                                   FontSize="12" FontWeight="SemiBold" Foreground="#1C1C1E" Margin="4,0,8,0"/>
                    </DockPanel>

                    <DockPanel Margin="0,0,0,6">
                        <TextBlock Text="Верхній (ціль):" Width="95" VerticalAlignment="Center" FontSize="12" Foreground="#3A3A3C"/>
                        <Button x:Name="btnPickUpper" Content="Вибрати" Width="75" Height="26" DockPanel.Dock="Right"
                                Background="#E9E9EE" BorderThickness="0" Cursor="Hand"/>
                        <TextBlock x:Name="lblUpper" Text="Авто / Не вибрано" VerticalAlignment="Center"
                                   FontSize="12" FontWeight="SemiBold" Foreground="#1C1C1E" Margin="4,0,8,0"/>
                    </DockPanel>

                    <DockPanel Margin="0,4,0,0">
                        <TextBlock Text="Зазор між ними (мм):" VerticalAlignment="Center" FontSize="12" Foreground="#3A3A3C"/>
                        <TextBox x:Name="tbGap" Text="0" Width="75" Height="24" HorizontalAlignment="Right"
                                 VerticalContentAlignment="Center" Padding="6,0" BorderBrush="#D1D1D6"/>
                    </DockPanel>
                </StackPanel>
            </Border>

            <Button x:Name="btnAlignSelected" Height="36" Margin="0,0,0,8"
                    Background="#007AFF" Foreground="#FFFFFF" FontWeight="SemiBold" BorderThickness="0" Cursor="Hand"
                    Content="Вирівняти (2 виділені або вибрані вище)"/>

            <Button x:Name="btnPickAndAlign" Height="32" Margin="0,0,0,10"
                    Background="#E9E9EE" Foreground="#1C1C1E" FontWeight="Medium" BorderThickness="0" Cursor="Hand"
                    Content="Клікнути 2 сілінги в моделі та вирівняти"/>

            <Border Background="#EFEFF4" CornerRadius="6" Padding="8">
                <TextBlock x:Name="lblStatus"
                           Text="Виділіть 2 сілінги у Revit та натисніть синю кнопку, або натисніть «Вибрати»."
                           FontSize="11.5" Foreground="#3A3A3C" TextWrapping="Wrap"/>
            </Border>
        </StackPanel>
    </Border>
</Window>
"""

# Зберігаємо глобальне посилання у модулі, щоб IronPython Garbage Collector не знищив IExternalEventHandler
_ACTIVE_WINDOW = [None]


class CeilingAlignWindow(object):
    def __init__(self, app):
        self.lower_id = None
        self.upper_id = None

        self.handler = ExternalActionHandler()
        self.handler.window = self
        self.ext_event = ExternalEvent.Create(self.handler)

        reader = XmlReader.Create(StringReader(XAML_LAYOUT))
        self.win = XamlReader.Load(reader)

        try:
            WindowInteropHelper(self.win).Owner = app.MainWindowHandle
        except Exception:
            pass

        self.lblLower = self.win.FindName("lblLower")
        self.lblUpper = self.win.FindName("lblUpper")
        self.tbGap = self.win.FindName("tbGap")
        self.lblStatus = self.win.FindName("lblStatus")

        self.btnPickLower = self.win.FindName("btnPickLower")
        self.btnPickUpper = self.win.FindName("btnPickUpper")
        self.btnAlignSelected = self.win.FindName("btnAlignSelected")
        self.btnPickAndAlign = self.win.FindName("btnPickAndAlign")

        self.btnPickLower.Click += self.on_pick_lower
        self.btnPickUpper.Click += self.on_pick_upper
        self.btnAlignSelected.Click += self.on_align_selected
        self.btnPickAndAlign.Click += self.on_pick_and_align
        self.win.Closed += self.on_closed

    def on_closed(self, sender, args):
        _ACTIVE_WINDOW[0] = None

    def set_status(self, text, is_error=False):
        self.lblStatus.Text = text
        if is_error:
            self.lblStatus.Foreground = SolidColorBrush(Color.FromRgb(215, 0, 21))
        else:
            self.lblStatus.Foreground = SolidColorBrush(Color.FromRgb(58, 58, 60))

    def get_gap_mm(self):
        try:
            txt = (self.tbGap.Text or "0").strip().replace(",", ".")
            return float(txt)
        except Exception:
            return 0.0

    def run_in_revit(self, fn, hide_while_picking=False):
        def _wrapped(app):
            try:
                if hide_while_picking:
                    focus_revit_window(app)
                fn(app)
            finally:
                if hide_while_picking:
                    try:
                        self.win.Show()
                        self.win.Activate()
                    except Exception:
                        pass

        if hide_while_picking:
            self.win.Hide()
            focus_revit_window(uiapp)

        self.handler.queue.append(_wrapped)
        req = self.ext_event.Raise()
        if req != ExternalEventRequest.Accepted and req != ExternalEventRequest.Pending:
            self.handler.queue = []
            if hide_while_picking:
                self.win.Show()
            self.set_status(u"Revit зайнятий активною командою (натисніть Esc у Revit і спробуйте ще раз).", is_error=True)

    def on_pick_lower(self, sender, args):
        def _act(app):
            uidoc = app.ActiveUIDocument
            doc = uidoc.Document
            # Якщо вже виділено 1 елемент, можна використати PickObject
            ref = uidoc.Selection.PickObject(
                ObjectType.Element, SlabSelectionFilter(), u"Клікніть на НИЖНІЙ (базовий) сілінг у моделі"
            )
            el = doc.GetElement(ref.ElementId)
            self.lower_id = el.Id
            self.lblLower.Text = u"ID: {}".format(get_id_val(el.Id))
            self.set_status(u"✓ Нижній сілінг вибрано (ID {}). Тепер виберіть верхній або натисніть синю кнопку.".format(get_id_val(el.Id)))

        self.run_in_revit(_act, hide_while_picking=True)

    def on_pick_upper(self, sender, args):
        def _act(app):
            uidoc = app.ActiveUIDocument
            doc = uidoc.Document
            ref = uidoc.Selection.PickObject(
                ObjectType.Element, SlabSelectionFilter(), u"Клікніть на ВЕРХНІЙ сілінг, який потрібно покласти на нижній"
            )
            el = doc.GetElement(ref.ElementId)
            self.upper_id = el.Id
            self.lblUpper.Text = u"ID: {}".format(get_id_val(el.Id))
            if self.lower_id is not None and get_id_val(self.lower_id) != get_id_val(self.upper_id):
                # Якщо обидва вже вибрані — одразу пропонуємо або виконуємо
                self.set_status(u"✓ Обидва сілінги вибрано! Натисніть синю кнопку «Вирівняти».")
            else:
                self.set_status(u"✓ Верхній сілінг вибрано (ID {}).".format(get_id_val(el.Id)))

        self.run_in_revit(_act, hide_while_picking=True)

    def on_align_selected(self, sender, args):
        def _act(app):
            uidoc = app.ActiveUIDocument
            doc = uidoc.Document
            sel_ids = list(uidoc.Selection.GetElementIds())
            slabs = [doc.GetElement(eid) for eid in sel_ids if is_valid_slab(doc.GetElement(eid))]

            if len(slabs) == 2:
                slabs.sort(key=lambda c: get_mean_z(c))
                lower_el, upper_el = slabs[0], slabs[1]
                self.lower_id = lower_el.Id
                self.upper_id = upper_el.Id
                self.lblLower.Text = u"ID: {} (Авто)".format(get_id_val(lower_el.Id))
                self.lblUpper.Text = u"ID: {} (Авто)".format(get_id_val(upper_el.Id))
            elif self.lower_id is not None and self.upper_id is not None:
                lower_el = doc.GetElement(self.lower_id)
                upper_el = doc.GetElement(self.upper_id)
                if lower_el is None or upper_el is None:
                    raise ValueError(u"Вибрані раніше сілінги не знайдено. Виберіть їх заново.")
            else:
                raise ValueError(u"Спочатку виділіть 2 сілінги через Ctrl у моделі, або виберіть Нижній і Верхній кнопками «Вибрати».")

            if get_id_val(lower_el.Id) == get_id_val(upper_el.Id):
                raise ValueError(u"Нижній і верхній сілінг — це один і той самий елемент!")

            msg = align_upper_ceiling_to_lower(doc, lower_el, upper_el, self.get_gap_mm())
            self.set_status(msg, is_error=False)

        self.run_in_revit(_act, hide_while_picking=False)

    def on_pick_and_align(self, sender, args):
        def _act(app):
            uidoc = app.ActiveUIDocument
            doc = uidoc.Document
            flt = SlabSelectionFilter()
            r1 = uidoc.Selection.PickObject(ObjectType.Element, flt, u"Крок 1/2: Клікніть на перший сілінг у моделі")
            r2 = uidoc.Selection.PickObject(ObjectType.Element, flt, u"Крок 2/2: Клікніть на другий сілінг у моделі")
            c1 = doc.GetElement(r1.ElementId)
            c2 = doc.GetElement(r2.ElementId)
            if get_id_val(c1.Id) == get_id_val(c2.Id):
                raise ValueError(u"Ви вибрали один і той самий сілінг двічі.")

            pair = sorted([c1, c2], key=lambda c: get_mean_z(c))
            lower_el, upper_el = pair[0], pair[1]
            self.lower_id = lower_el.Id
            self.upper_id = upper_el.Id
            self.lblLower.Text = u"ID: {} (Авто)".format(get_id_val(lower_el.Id))
            self.lblUpper.Text = u"ID: {} (Авто)".format(get_id_val(upper_el.Id))

            msg = align_upper_ceiling_to_lower(doc, lower_el, upper_el, self.get_gap_mm())
            self.set_status(msg, is_error=False)

        self.run_in_revit(_act, hide_while_picking=True)

    def show(self):
        self.win.Show()


if _ACTIVE_WINDOW[0] is not None:
    try:
        _ACTIVE_WINDOW[0].win.Close()
    except Exception:
        pass

_ACTIVE_WINDOW[0] = CeilingAlignWindow(uiapp)
_ACTIVE_WINDOW[0].show()
