
import clr
import os
import re
import json
import time
clr.AddReference("PresentationFramework")
clr.AddReference("PresentationCore")
clr.AddReference("WindowsBase")
clr.AddReference("System.Xml")
clr.AddReference("System.Windows.Forms")

from System.IO import StringReader
from System.Windows.Forms import FolderBrowserDialog, DialogResult
from System.Xml import XmlReader
from System.Collections.Generic import List
from System.Windows import (Thickness, TextTrimming, Visibility, MessageBox,
                            MessageBoxButton, MessageBoxResult, CornerRadius, FontWeights,
                            VerticalAlignment)
from System.Windows.Markup import XamlReader
from System.Windows.Controls import (ListBoxItem, DockPanel, TextBlock, Dock, ScrollViewer,
                                      Border, Button, CheckBox, StackPanel, Orientation)
from System.Windows.Media import Brushes, BrushConverter, VisualTreeHelper

from Autodesk.Revit.DB import (FilteredElementCollector, ViewSheetSet, ViewSheet,
                               View, ViewSet, Transaction, PrintRange, ElementId,
                               BrowserOrganization, Revision)
try:
    from Autodesk.Revit.DB import PDFExportOptions
except ImportError:
    PDFExportOptions = None
try:
    from Autodesk.Revit.DB import BaseExportOptions
except ImportError:
    BaseExportOptions = None
try:
    from Autodesk.Revit.DB import DWGExportOptions
except ImportError:
    DWGExportOptions = None
try:
    from Autodesk.Revit.DB import DXFExportOptions
except ImportError:
    DXFExportOptions = None
try:
    from Autodesk.Revit.DB import DGNExportOptions
except ImportError:
    DGNExportOptions = None
try:
    from Autodesk.Revit.DB import DWFExportOptions
except ImportError:
    DWFExportOptions = None
try:
    from Autodesk.Revit.DB import DWFXExportOptions
except ImportError:
    DWFXExportOptions = None
from Autodesk.Revit.UI import (IExternalEventHandler, ExternalEvent,
                               RevitCommandId, PostableCommand)


# ======================================================================
#  Shared modules: working with views, Elevation markers and helper functions
# ======================================================================
import os
import sys
import json
import uuid
import datetime
import traceback
import codecs
import shutil
try:
    unicode
except NameError:
    unicode = str
try:
    basestring
except NameError:
    basestring = str


import math

import clr
clr.AddReference("RevitAPI")
clr.AddReference("RevitAPIUI")
clr.AddReference("PresentationFramework")
clr.AddReference("PresentationCore")
clr.AddReference("WindowsBase")
clr.AddReference("System.Xaml")
clr.AddReference("System.Data")
clr.AddReference("System.Xml")
clr.AddReference("System.Xml.Linq")

from Autodesk.Revit.DB import (
    CopyPasteOptions,
    BuiltInParameter,
    BuiltInCategory,
    Curve,
    CurveElement,
    Dimension,
    DimensionStyleType,
    DimensionType,
    Edge,
    ElementId,
    ElementReferenceType,
    ElementTransformUtils,
    FailureProcessingResult,
    FailureSeverity,
    FilteredElementCollector,
    FamilyInstance,
    FamilyInstanceReferenceType,
    FamilySymbol,
    GeometryInstance,
    Grid,
    IFailuresPreprocessor,
    IndependentTag,
    LeaderEndCondition,
    Level,
    LinkElementId,
    LocationCurve,
    LocationPoint,
    Line,
    MultiReferenceAnnotation,
    Plane,
    PlanarFace,
    Options,
    Reference,
    ReferenceArray,
    RevitLinkInstance,
    SketchPlane,
    SubTransaction,
    Solid,
    SpatialElementTag,
    TextNote,
    Transaction,
    TransactionGroup,
    TransactionStatus,
    Transform,
    UV,
    View,
    ViewSheet,
    ViewSchedule,
    ViewDuplicateOption,
    Viewport,
    ScheduleSheetInstance,
    StorageType,
    NamingUtils,
    ViewType,
    XYZ,
)
from Autodesk.Revit.DB.Architecture import Room, RoomTag
from Autodesk.Revit.Exceptions import OperationCanceledException
from Autodesk.Revit.UI import ExternalEvent, ExternalEventRequest, IExternalEventHandler
from Autodesk.Revit.UI.Selection import ObjectType
from System import TimeSpan, Int32, Int64, String, Boolean, Guid
import System
import Autodesk.Revit.DB as DB
import Autodesk.Revit.DB.ExtensibleStorage
from System.IO import File, FileInfo
from System.Xml import XmlReader, XmlReaderSettings, DtdProcessing
from System.Xml.Linq import XDocument, XElement
from Microsoft.Win32 import OpenFileDialog, SaveFileDialog
from System.Data import DataTable
from System.Collections.Generic import List
from System.Windows import Clipboard, CornerRadius, Thickness, TextWrapping, TextTrimming, Visibility
from System.Windows.Controls import CheckBox, Dock, DockPanel, StackPanel, TextBlock, Orientation, DataGridEditingUnit, Canvas, DataGridLength
from System.Windows.Markup import XamlReader
from System.Windows.Interop import WindowInteropHelper
from System.Windows.Media import Color, SolidColorBrush, DoubleCollection
from System.Windows.Threading import DispatcherTimer
from System.Windows.Shapes import Rectangle

# ElementIdSetFilter is missing in older Revit API versions - fall back to a manual intersection
try:
    from Autodesk.Revit.DB import ElementIdSetFilter
except ImportError:
    ElementIdSetFilter = None


def ids_in_view(view_id, wanted):
    """ElementIds from `wanted` (List[ElementId]) that are present in the view."""
    col = FilteredElementCollector(doc, view_id)
    if ElementIdSetFilter is not None:
        return col.WherePasses(ElementIdSetFilter(wanted)).WhereElementIsNotElementType().ToElementIds()
    want = set(w.IntegerValue for w in wanted)
    return [i for i in col.WhereElementIsNotElementType().ToElementIds() if i.IntegerValue in want]

# UI application is supplied by the launcher.


def id_value(value):
    return (int(value.Value) if hasattr(value, "Value") else int(value.IntegerValue)) if value is not None else -1


def revit_id(value):
    if isinstance(value, ElementId):
        return value
    if hasattr(ElementId, "Value"):
        return ElementId(Int64(int(value)))
    if int(value) < -2147483648 or int(value) > 2147483647:
        raise ValueError("This Revit version cannot represent the requested 64-bit element ID.")
    return ElementId(Int32(int(value)))

def id_value(value):
    if value is None:
        return -1
    return int(value.Value) if hasattr(value,"Value") else int(value.IntegerValue)


import re


from Autodesk.Revit.UI import TaskDialog, TaskDialogCommonButtons, TaskDialogResult
from Autodesk.Revit.UI.Selection import ISelectionFilter
from System.Windows import Window, WindowStartupLocation
from System.Windows.Controls import Button, TextBox, ListBox, ListBoxItem, ComboBox, ComboBoxItem, SelectionMode, ScrollViewer, Label
from System.Windows.Automation import AutomationProperties

DATA = os.path.join(System.Environment.GetFolderPath(System.Environment.SpecialFolder.LocalApplicationData), 'UniversalToolkit', 'data')
uiapp = __revit__
uidoc = uiapp.ActiveUIDocument
doc = uidoc.Document if uidoc else None


class Cancelled(Exception):
    pass


def fail(message):
    raise ValueError(message)


def now():
    return datetime.datetime.now().strftime('%Y%m%d_%H%M%S')


def eid(element):
    return id_value(element.Id)


def element(uid):
    found = doc.GetElement(uid)
    if found is None:
        fail(u'Reference contains a deleted element: ' + uid)
    return found


def title(element):
    try:
        return element.Name
    except Exception:
        return DB.Element.Name.GetValue(element)


def err_text(exc):
    """Safe text of an exception for IronPython 2.7 (no UnicodeEncodeError on Cyrillic)."""
    try:
        if exc.args and isinstance(exc.args[0], basestring):
            return exc.args[0]
        return unicode(exc)
    except Exception:
        return repr(exc)


def err_where():
    """Where exactly it failed: exception type + last traceback frames (for rollback diagnostics)."""
    try:
        et, ev, tb = sys.exc_info()
        frames = traceback.extract_tb(tb)[-3:]
        parts = [u'{}:{} {}'.format(os.path.basename(f[0]), f[1], f[2]) for f in frames]
        return u'\n[{}] '.format(getattr(et, '__name__', et)) + u' <- '.join(reversed(parts))
    except Exception:
        return u''


THEME_BASE = u"""
<Style x:Key="KeyboardFocus">
  <Setter Property="Control.Template">
    <Setter.Value><ControlTemplate><Border Margin="-3" CornerRadius="10" BorderBrush="#007AFF" BorderThickness="2"/></ControlTemplate></Setter.Value>
  </Setter>
</Style>
<Style TargetType="Button">
  <Setter Property="Background" Value="#E9E9EE"/>
  <Setter Property="Foreground" Value="#1C1C1E"/>
  <Setter Property="BorderThickness" Value="0"/>
  <Setter Property="Padding" Value="16,7"/>
  <Setter Property="MinHeight" Value="32"/>
  <Setter Property="Cursor" Value="Hand"/>
  <Setter Property="FocusVisualStyle" Value="{StaticResource KeyboardFocus}"/>
  <Setter Property="Template">
    <Setter.Value>
      <ControlTemplate TargetType="Button">
        <Grid>
          <Border x:Name="Bd" CornerRadius="8" Background="{TemplateBinding Background}"/>
          <Border x:Name="Ov" CornerRadius="8" Background="#14000000" Opacity="0" IsHitTestVisible="False"/>
          <ContentPresenter Margin="{TemplateBinding Padding}" HorizontalAlignment="Center" VerticalAlignment="Center" RecognizesAccessKey="True"/>
        </Grid>
        <ControlTemplate.Triggers>
          <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="Ov" Property="Opacity" Value="1"/></Trigger>
          <Trigger Property="IsPressed" Value="True"><Setter TargetName="Ov" Property="Background" Value="#2A000000"/><Setter TargetName="Ov" Property="Opacity" Value="1"/></Trigger>
          <Trigger Property="IsEnabled" Value="False"><Setter Property="Opacity" Value="0.4"/></Trigger>
        </ControlTemplate.Triggers>
      </ControlTemplate>
    </Setter.Value>
  </Setter>
  <Style.Triggers>
    <Trigger Property="IsDefault" Value="True">
      <Setter Property="Background" Value="#007AFF"/>
      <Setter Property="Foreground" Value="#FFFFFF"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
    </Trigger>
  </Style.Triggers>
</Style>
<Style TargetType="TextBox">
  <Setter Property="Background" Value="#FFFFFF"/>
  <Setter Property="BorderBrush" Value="#D1D1D6"/>
  <Setter Property="BorderThickness" Value="1"/>
  <Setter Property="Padding" Value="8,6"/>
  <Setter Property="Template">
    <Setter.Value>
      <ControlTemplate TargetType="TextBox">
        <Border x:Name="Bd" CornerRadius="8" Background="{TemplateBinding Background}" BorderBrush="{TemplateBinding BorderBrush}" BorderThickness="{TemplateBinding BorderThickness}">
          <ScrollViewer x:Name="PART_ContentHost" Margin="{TemplateBinding Padding}" Focusable="False"/>
        </Border>
        <ControlTemplate.Triggers>
          <Trigger Property="IsKeyboardFocused" Value="True"><Setter TargetName="Bd" Property="BorderBrush" Value="#007AFF"/></Trigger>
          <Trigger Property="IsEnabled" Value="False"><Setter Property="Opacity" Value="0.5"/></Trigger>
        </ControlTemplate.Triggers>
      </ControlTemplate>
    </Setter.Value>
  </Setter>
</Style>
<Style TargetType="ListBox">
  <Setter Property="Background" Value="Transparent"/>
  <Setter Property="BorderThickness" Value="0"/>
  <Setter Property="Padding" Value="0,0,4,0"/>
  <Setter Property="ScrollViewer.HorizontalScrollBarVisibility" Value="Disabled"/>
  <Setter Property="Template">
    <Setter.Value>
      <ControlTemplate TargetType="ListBox">
        <ScrollViewer Focusable="False" Padding="{TemplateBinding Padding}" VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled">
          <ItemsPresenter/>
        </ScrollViewer>
      </ControlTemplate>
    </Setter.Value>
  </Setter>
</Style>
<Style TargetType="ListBoxItem">
  <Setter Property="Background" Value="Transparent"/>
  <Setter Property="BorderThickness" Value="0"/>
  <Setter Property="Margin" Value="0,1"/>
  <Setter Property="Padding" Value="10,7"/>
  <Setter Property="HorizontalContentAlignment" Value="Stretch"/>
  <Setter Property="FocusVisualStyle" Value="{StaticResource KeyboardFocus}"/>
  <Setter Property="Template">
    <Setter.Value>
      <ControlTemplate TargetType="ListBoxItem">
        <Border x:Name="Bd" CornerRadius="8" Background="{TemplateBinding Background}">
          <ContentPresenter Margin="{TemplateBinding Padding}" HorizontalAlignment="{TemplateBinding HorizontalContentAlignment}" VerticalAlignment="Center"/>
        </Border>
        <ControlTemplate.Triggers>
          <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="Bd" Property="Background" Value="#F2F2F7"/></Trigger>
          <Trigger Property="IsSelected" Value="True"><Setter TargetName="Bd" Property="Background" Value="#E5F0FF"/></Trigger>
        </ControlTemplate.Triggers>
      </ControlTemplate>
    </Setter.Value>
  </Setter>
</Style>
<Style TargetType="Label">
  <Setter Property="FontWeight" Value="SemiBold"/>
  <Setter Property="FontSize" Value="12"/>
  <Setter Property="Padding" Value="2,8,0,4"/>
  <Setter Property="Foreground" Value="#6E6E73"/>
</Style>
"""

THEME_COMMON = u"""
<Style x:Key="ScrollRepeat" TargetType="RepeatButton">
  <Setter Property="Focusable" Value="False"/>
  <Setter Property="IsTabStop" Value="False"/>
  <Setter Property="Template">
    <Setter.Value>
      <ControlTemplate TargetType="RepeatButton"><Border Background="Transparent"/></ControlTemplate>
    </Setter.Value>
  </Setter>
</Style>
<Style x:Key="ScrollThumb" TargetType="Thumb">
  <Setter Property="Template">
    <Setter.Value>
      <ControlTemplate TargetType="Thumb">
        <Border x:Name="Th" Margin="2" CornerRadius="4" Background="#C7C7CC"/>
        <ControlTemplate.Triggers>
          <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="Th" Property="Background" Value="#8E8E93"/></Trigger>
          <Trigger Property="IsDragging" Value="True"><Setter TargetName="Th" Property="Background" Value="#636366"/></Trigger>
        </ControlTemplate.Triggers>
      </ControlTemplate>
    </Setter.Value>
  </Setter>
</Style>
<ControlTemplate x:Key="VScrollTpl" TargetType="ScrollBar">
  <Grid Background="Transparent">
    <Track x:Name="PART_Track" IsDirectionReversed="True">
      <Track.DecreaseRepeatButton><RepeatButton Command="ScrollBar.PageUpCommand" Style="{StaticResource ScrollRepeat}"/></Track.DecreaseRepeatButton>
      <Track.Thumb><Thumb Style="{StaticResource ScrollThumb}"/></Track.Thumb>
      <Track.IncreaseRepeatButton><RepeatButton Command="ScrollBar.PageDownCommand" Style="{StaticResource ScrollRepeat}"/></Track.IncreaseRepeatButton>
    </Track>
  </Grid>
</ControlTemplate>
<ControlTemplate x:Key="HScrollTpl" TargetType="ScrollBar">
  <Grid Background="Transparent">
    <Track x:Name="PART_Track" IsDirectionReversed="False">
      <Track.DecreaseRepeatButton><RepeatButton Command="ScrollBar.PageLeftCommand" Style="{StaticResource ScrollRepeat}"/></Track.DecreaseRepeatButton>
      <Track.Thumb><Thumb Style="{StaticResource ScrollThumb}"/></Track.Thumb>
      <Track.IncreaseRepeatButton><RepeatButton Command="ScrollBar.PageRightCommand" Style="{StaticResource ScrollRepeat}"/></Track.IncreaseRepeatButton>
    </Track>
  </Grid>
</ControlTemplate>
<Style TargetType="ScrollBar">
  <Setter Property="Background" Value="Transparent"/>
  <Setter Property="Width" Value="11"/>
  <Setter Property="MinWidth" Value="11"/>
  <Setter Property="Template" Value="{StaticResource VScrollTpl}"/>
  <Style.Triggers>
    <Trigger Property="Orientation" Value="Horizontal">
      <Setter Property="Width" Value="Auto"/>
      <Setter Property="MinWidth" Value="0"/>
      <Setter Property="Height" Value="11"/>
      <Setter Property="MinHeight" Value="11"/>
      <Setter Property="Template" Value="{StaticResource HScrollTpl}"/>
    </Trigger>
  </Style.Triggers>
</Style>
<Style TargetType="CheckBox">
  <Setter Property="Cursor" Value="Hand"/>
  <Setter Property="Template">
    <Setter.Value>
      <ControlTemplate TargetType="CheckBox">
        <Grid Background="Transparent">
          <Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
          <Border x:Name="Bx" Width="18" Height="18" CornerRadius="5" Background="#FFFFFF" BorderBrush="#C7C7CC" BorderThickness="1.5" VerticalAlignment="Center">
            <Grid>
              <Path x:Name="Ck" Data="M3.5,8.5 L7,12 L13.5,4.5" Stroke="#FFFFFF" StrokeThickness="2" StrokeStartLineCap="Round" StrokeEndLineCap="Round" StrokeLineJoin="Round" Visibility="Collapsed" HorizontalAlignment="Center" VerticalAlignment="Center"/>
              <Border x:Name="Dh" Width="8" Height="2" CornerRadius="1" Background="#FFFFFF" Visibility="Collapsed" HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Grid>
          </Border>
          <ContentPresenter Grid.Column="1" Margin="8,0,0,0" VerticalAlignment="Center" RecognizesAccessKey="True"/>
        </Grid>
        <ControlTemplate.Triggers>
          <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="Bx" Property="BorderBrush" Value="#8E8E93"/></Trigger>
          <Trigger Property="IsChecked" Value="True">
            <Setter TargetName="Bx" Property="Background" Value="#007AFF"/>
            <Setter TargetName="Bx" Property="BorderBrush" Value="#007AFF"/>
            <Setter TargetName="Ck" Property="Visibility" Value="Visible"/>
          </Trigger>
          <Trigger Property="IsChecked" Value="{x:Null}">
            <Setter TargetName="Bx" Property="Background" Value="#007AFF"/>
            <Setter TargetName="Bx" Property="BorderBrush" Value="#007AFF"/>
            <Setter TargetName="Dh" Property="Visibility" Value="Visible"/>
          </Trigger>
          <Trigger Property="IsEnabled" Value="False"><Setter Property="Opacity" Value="0.45"/></Trigger>
        </ControlTemplate.Triggers>
      </ControlTemplate>
    </Setter.Value>
  </Setter>
</Style>
<Style TargetType="ComboBoxItem">
  <Setter Property="Padding" Value="10,6"/>
  <Setter Property="Foreground" Value="#1C1C1E"/>
  <Setter Property="HorizontalContentAlignment" Value="Stretch"/>
  <Setter Property="Template">
    <Setter.Value>
      <ControlTemplate TargetType="ComboBoxItem">
        <Border x:Name="Bd" CornerRadius="6" Margin="0,1" Background="Transparent" Padding="{TemplateBinding Padding}">
          <ContentPresenter HorizontalAlignment="{TemplateBinding HorizontalContentAlignment}" VerticalAlignment="Center"/>
        </Border>
        <ControlTemplate.Triggers>
          <Trigger Property="IsSelected" Value="True"><Setter TargetName="Bd" Property="Background" Value="#E5F0FF"/></Trigger>
          <Trigger Property="IsHighlighted" Value="True">
            <Setter TargetName="Bd" Property="Background" Value="#007AFF"/>
            <Setter Property="Foreground" Value="#FFFFFF"/>
          </Trigger>
          <Trigger Property="IsEnabled" Value="False"><Setter Property="Opacity" Value="0.4"/></Trigger>
        </ControlTemplate.Triggers>
      </ControlTemplate>
    </Setter.Value>
  </Setter>
</Style>
<Style TargetType="ComboBox">
  <Setter Property="Padding" Value="10,5,28,5"/>
  <Setter Property="MinHeight" Value="32"/>
  <Setter Property="Background" Value="#FFFFFF"/>
  <Setter Property="BorderBrush" Value="#D1D1D6"/>
  <Setter Property="BorderThickness" Value="1"/>
  <Setter Property="Foreground" Value="#1C1C1E"/>
  <Setter Property="Template">
    <Setter.Value>
      <ControlTemplate TargetType="ComboBox">
        <Grid>
          <Border x:Name="Bd" CornerRadius="8" Background="{TemplateBinding Background}" BorderBrush="{TemplateBinding BorderBrush}" BorderThickness="{TemplateBinding BorderThickness}"/>
          <ToggleButton x:Name="Tg" Focusable="False" ClickMode="Press" IsChecked="{Binding IsDropDownOpen, Mode=TwoWay, RelativeSource={RelativeSource TemplatedParent}}">
            <ToggleButton.Template>
              <ControlTemplate TargetType="ToggleButton">
                <Border Background="Transparent">
                  <TextBlock Text="&#xE70D;" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" FontSize="10" Foreground="#8E8E93" HorizontalAlignment="Right" VerticalAlignment="Center" Margin="0,0,10,0"/>
                </Border>
              </ControlTemplate>
            </ToggleButton.Template>
          </ToggleButton>
          <ContentPresenter x:Name="Cp" IsHitTestVisible="False" Content="{TemplateBinding SelectionBoxItem}" ContentTemplate="{TemplateBinding SelectionBoxItemTemplate}" ContentStringFormat="{TemplateBinding SelectionBoxItemStringFormat}" Margin="{TemplateBinding Padding}" HorizontalAlignment="Left" VerticalAlignment="Center"/>
          <TextBox x:Name="PART_EditableTextBox" Style="{x:Null}" Visibility="Collapsed" Background="Transparent" BorderThickness="0" Focusable="True" IsReadOnly="{TemplateBinding IsReadOnly}" Margin="8,0,28,0" VerticalAlignment="Center" HorizontalAlignment="Stretch"/>
          <Popup x:Name="PART_Popup" Placement="Bottom" IsOpen="{TemplateBinding IsDropDownOpen}" AllowsTransparency="True" Focusable="False" PopupAnimation="Fade">
            <Grid MinWidth="{TemplateBinding ActualWidth}" MaxHeight="{TemplateBinding MaxDropDownHeight}" Margin="0,2,12,14">
              <Border CornerRadius="10" Background="#FFFFFF" BorderBrush="#26000000" BorderThickness="1">
                <Border.Effect><DropShadowEffect BlurRadius="14" ShadowDepth="3" Opacity="0.25" Color="Black"/></Border.Effect>
                <ScrollViewer Margin="4" SnapsToDevicePixels="True"><StackPanel IsItemsHost="True" KeyboardNavigation.DirectionalNavigation="Contained"/></ScrollViewer>
              </Border>
            </Grid>
          </Popup>
        </Grid>
        <ControlTemplate.Triggers>
          <Trigger Property="IsEditable" Value="True">
            <Setter TargetName="PART_EditableTextBox" Property="Visibility" Value="Visible"/>
            <Setter TargetName="Cp" Property="Visibility" Value="Collapsed"/>
          </Trigger>
          <Trigger Property="IsKeyboardFocusWithin" Value="True"><Setter TargetName="Bd" Property="BorderBrush" Value="#007AFF"/></Trigger>
          <Trigger Property="IsEnabled" Value="False"><Setter Property="Opacity" Value="0.5"/></Trigger>
        </ControlTemplate.Triggers>
      </ControlTemplate>
    </Setter.Value>
  </Setter>
</Style>
<Style TargetType="ProgressBar">
  <Setter Property="Foreground" Value="#007AFF"/>
  <Setter Property="Background" Value="#E5E5EA"/>
  <Setter Property="Template">
    <Setter.Value>
      <ControlTemplate TargetType="ProgressBar">
        <Grid Height="8" VerticalAlignment="Center">
          <Border x:Name="PART_Track" CornerRadius="4" Background="{TemplateBinding Background}"/>
          <Border x:Name="PART_Indicator" CornerRadius="4" Background="{TemplateBinding Foreground}" HorizontalAlignment="Left"/>
        </Grid>
      </ControlTemplate>
    </Setter.Value>
  </Setter>
</Style>
<Style TargetType="TabItem">
  <Setter Property="Foreground" Value="#3A3A3C"/>
  <Setter Property="Cursor" Value="Hand"/>
  <Setter Property="Template">
    <Setter.Value>
      <ControlTemplate TargetType="TabItem">
        <Border x:Name="Bd" CornerRadius="6" Background="Transparent" Padding="14,5" MinWidth="80">
          <ContentPresenter ContentSource="Header" HorizontalAlignment="Center" VerticalAlignment="Center"/>
        </Border>
        <ControlTemplate.Triggers>
          <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="Bd" Property="Background" Value="#14000000"/></Trigger>
          <Trigger Property="IsSelected" Value="True">
            <Setter TargetName="Bd" Property="Background" Value="#FFFFFF"/>
            <Setter Property="FontWeight" Value="SemiBold"/>
          </Trigger>
        </ControlTemplate.Triggers>
      </ControlTemplate>
    </Setter.Value>
  </Setter>
</Style>
<Style TargetType="TabControl">
  <Setter Property="Background" Value="Transparent"/>
  <Setter Property="BorderThickness" Value="0"/>
  <Setter Property="Padding" Value="0"/>
  <Setter Property="Template">
    <Setter.Value>
      <ControlTemplate TargetType="TabControl">
        <DockPanel>
          <Border DockPanel.Dock="Top" HorizontalAlignment="Left" Background="#E3E3E8" CornerRadius="8" Padding="2" Margin="0,0,0,10">
            <StackPanel IsItemsHost="True" Orientation="Horizontal"/>
          </Border>
          <ContentPresenter ContentSource="SelectedContent"/>
        </DockPanel>
      </ControlTemplate>
    </Setter.Value>
  </Setter>
</Style>
"""

THEME_ITEMS = THEME_BASE + THEME_COMMON

# ---------------------------------------------------------------------------
#  Dark palette for "Dynamic Island": light Apple palette -> dark
# ---------------------------------------------------------------------------
TK_DARK_MAP = {
    u"#1C1C1E": u"#F5F5F7", u"#6E6E73": u"#A1A1A6", u"#E5E5EA": u"#2C2C2E",
    u"#D1D1D6": u"#3A3A3C", u"#C7C7CC": u"#5A5A5E", u"#E9E9EE": u"#2C2C2E",
    u"#EFEFF4": u"#222225", u"#ECECF1": u"#3A3A3C", u"#F1F1F6": u"#0F0F11",
    u"#F2F2F7": u"#1C1C1E", u"#F7F7FA": u"#161618", u"#E3E3E8": u"#1C1C1E",
    u"#E5F0FF": u"#0F2A4D", u"#EAF2FF": u"#0F2A4D", u"#D6E6FF": u"#17407A",
    u"#FFF6DD": u"#3A2E0A", u"#6B4E00": u"#FFD479", u"#FFF9EC": u"#2A2110",
    u"#FFD9A0": u"#5A4318", u"#3A3A3C": u"#D1D1D6", u"#007AFF": u"#0A84FF",
    u"#14000000": u"#14FFFFFF", u"#10000000": u"#10FFFFFF", u"#0D000000": u"#0DFFFFFF",
    u"#1A000000": u"#1AFFFFFF", u"#26000000": u"#26FFFFFF",
}


def tk_dark_remap(text):
    """Recolors XAML from the light theme to dark (single pass, no chains)."""
    text = re.sub(u"#[0-9A-Fa-f]{8}\\b|#[0-9A-Fa-f]{6}\\b",
                  lambda m: TK_DARK_MAP.get(m.group(0).upper(), m.group(0)), text)
    out = []
    for line in text.split(u"\n"):
        if u'x:Name="Dh"' not in line:   # white dash "—" in the checkbox stays white
            line = re.sub(u'(Background|BorderBrush)="(?:White|#FFFFFF)"', u'\\1="#1C1C1E"', line)
        line = re.sub(u'(Property="(?:Background|BorderBrush)"\\s+Value=)"(?:White|#FFFFFF)"',
                      u'\\1"#1C1C1E"', line)
        out.append(line)
    return u"\n".join(out)


THEME_COMMON_DARK = tk_dark_remap(THEME_COMMON)

THEME_XAML = (u'<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" '
              u'xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">' + THEME_ITEMS + u'</ResourceDictionary>')

def apply_theme(win):
    from System.Windows.Media import FontFamily
    try:
        win.Resources.MergedDictionaries.Add(XamlReader.Parse(THEME_XAML))
    except Exception:
        pass  # the dialog works without the theme anyway
    win.Background = SolidColorBrush(Color.FromRgb(0xF5, 0xF5, 0xF7))
    win.Foreground = SolidColorBrush(Color.FromRgb(0x1C, 0x1C, 0x1E))
    win.FontFamily = FontFamily('Segoe UI Variable Text, Segoe UI, Arial')
    win.FontSize = 13


# ---------------------------------------------------------------------------
#  Apple-style design system for all custom dialogs
#  (window chrome, cards, badges, icon tiles, search, buttons)
# ---------------------------------------------------------------------------
_ICON_FONT = [None]


def ui_icon_font():
    if _ICON_FONT[0] is None:
        from System.Windows.Media import FontFamily
        _ICON_FONT[0] = FontFamily(u'Segoe Fluent Icons, Segoe MDL2 Assets')
    return _ICON_FONT[0]


def ui_glyph(code, size=14, color='#8E8E93'):
    glyph = TextBlock()
    glyph.FontFamily = ui_icon_font()
    glyph.Text, glyph.FontSize = code, size
    glyph.Foreground = ui_brush(color)
    glyph.HorizontalAlignment = System.Windows.HorizontalAlignment.Center
    glyph.VerticalAlignment = VerticalAlignment.Center
    return glyph


def ui_card(content, padding=16, tint=None, gap=12):
    card = Border()
    if tint == 'orange':
        card.Background, card.BorderBrush = ui_brush('#FFF9EC'), ui_brush('#FFD9A0')
    else:
        card.Background, card.BorderBrush = ui_brush('#FFFFFF'), ui_brush('#E5E5EA')
    card.BorderThickness = Thickness(1)
    card.CornerRadius = CornerRadius(12)
    card.Padding = Thickness(padding)
    card.Margin = Thickness(0, 0, 0, gap)
    card.Child = content
    return card


def ui_search(placeholder):
    """Search field with a magnifier, placeholder and clear button. Returns (container, TextBox, clear button)."""
    host = WpfGrid()
    box = TextBox()
    box.MinHeight = 34
    box.Padding = Thickness(32, 7, 30, 7)
    box.VerticalContentAlignment = VerticalAlignment.Center
    AutomationProperties.SetName(box, placeholder)
    host.Children.Add(box)
    lens = ui_glyph(u'\uE721', 13, '#8E8E93')
    lens.HorizontalAlignment = System.Windows.HorizontalAlignment.Left
    lens.Margin = Thickness(11, 0, 0, 0)
    lens.IsHitTestVisible = False
    host.Children.Add(lens)
    hint = TextBlock()
    hint.Text = placeholder
    hint.Foreground = ui_brush('#AEAEB2')
    hint.Margin = Thickness(33, 0, 30, 0)
    hint.VerticalAlignment = VerticalAlignment.Center
    hint.TextTrimming = TextTrimming.CharacterEllipsis
    hint.IsHitTestVisible = False
    host.Children.Add(hint)
    clear = Button()
    clear.Content = u'\uE711'
    clear.FontFamily = ui_icon_font()
    clear.FontSize = 9
    clear.Width, clear.Height, clear.MinHeight = 22, 22, 22
    clear.Padding = Thickness(0)
    clear.Background = Brushes.Transparent
    clear.Foreground = ui_brush('#8E8E93')
    clear.HorizontalAlignment = System.Windows.HorizontalAlignment.Right
    clear.Margin = Thickness(0, 0, 6, 0)
    clear.ToolTip = u'Clear (Esc)'
    AutomationProperties.SetName(clear, u'Clear search')
    host.Children.Add(clear)

    def changed(sender=None, args=None):
        has_text = bool(box.Text)
        hint.Visibility = Visibility.Collapsed if has_text else Visibility.Visible
        clear.Visibility = Visibility.Visible if has_text else Visibility.Collapsed

    def wipe(sender, args):
        box.Text = u''
        box.Focus()

    box.TextChanged += changed
    clear.Click += wipe
    changed()
    return host, box, clear


def btn_content(code, text):
    """Button content: Segoe Fluent icon + label."""
    row = StackPanel()
    row.Orientation = Orientation.Horizontal
    glyph = TextBlock()
    glyph.FontFamily = ui_icon_font()
    glyph.Text, glyph.FontSize = code, 13
    glyph.VerticalAlignment = VerticalAlignment.Center
    glyph.Margin = Thickness(0, 0, 7, 0)
    label = TextBlock()
    label.Text = text
    label.VerticalAlignment = VerticalAlignment.Center
    row.Children.Add(glyph)
    row.Children.Add(label)
    return row


def window(caption, message):
    """Apple-style window without the Windows frame: rounded card with shadow, red close button,
    centered title and a bottom button bar. Returns (window, content panel, right buttons);
    left (secondary) buttons are stored in buttons.Tag."""
    from System.Windows.Media.Effects import DropShadowEffect
    win = Window()
    apply_theme(win)
    win.Title = caption
    win.WindowStyle = getattr(System.Windows.WindowStyle, 'None')
    win.AllowsTransparency = True
    win.Background = Brushes.Transparent
    win.ResizeMode = System.Windows.ResizeMode.CanResizeWithGrip
    win.ShowInTaskbar = False
    win.Width, win.Height = 740, 580
    fit_window(win)
    win.MinWidth, win.MinHeight = 560, 380
    win.WindowStartupLocation = WindowStartupLocation.CenterScreen
    try:
        WindowInteropHelper(win).Owner = uiapp.MainWindowHandle
    except Exception:
        pass

    shell = Border()
    shell.Margin = Thickness(16)
    shell.CornerRadius = CornerRadius(12)
    shell.Background = ui_brush('#F5F5F7')
    shell.BorderBrush = ui_brush('#26000000')
    shell.BorderThickness = Thickness(1)
    shell.Effect = DropShadowEffect(BlurRadius=24, ShadowDepth=4, Opacity=0.28)
    root = WpfGrid()
    for height in (System.Windows.GridLength(46),
                   System.Windows.GridLength(1.0, System.Windows.GridUnitType.Star),
                   System.Windows.GridLength.Auto):
        row = RowDefinition()
        row.Height = height
        root.RowDefinitions.Add(row)

    # --- title row ---
    bar = Border()
    bar.Background = Brushes.Transparent
    bar_grid = WpfGrid()
    caption_text = TextBlock()
    caption_text.Text = caption
    caption_text.FontWeight = System.Windows.FontWeights.SemiBold
    caption_text.Foreground = ui_brush('#1C1C1E')
    caption_text.HorizontalAlignment = System.Windows.HorizontalAlignment.Center
    caption_text.VerticalAlignment = VerticalAlignment.Center
    caption_text.TextTrimming = TextTrimming.CharacterEllipsis
    caption_text.Margin = Thickness(90, 0, 90, 0)
    caption_text.IsHitTestVisible = False
    bar_grid.Children.Add(caption_text)
    close = Border()
    close.Width, close.Height = 13, 13
    close.CornerRadius = CornerRadius(7)
    close.Background = ui_brush('#FF5F57')
    close.Cursor = System.Windows.Input.Cursors.Hand
    close.ToolTip = u'Close'
    close.HorizontalAlignment = System.Windows.HorizontalAlignment.Left
    close.Margin = Thickness(16, 0, 0, 0)
    cross = ui_glyph(u'\uE711', 7, '#7A0A05')
    cross.Opacity = 0.0
    close.Child = cross

    def close_enter(sender, args):
        cross.Opacity = 1.0

    def close_leave(sender, args):
        cross.Opacity = 0.0

    def close_down(sender, args):
        args.Handled = True

    def close_up(sender, args):
        win.Close()

    def drag(sender, args):
        try:
            win.DragMove()
        except Exception:
            pass

    close.MouseEnter += close_enter
    close.MouseLeave += close_leave
    close.MouseLeftButtonDown += close_down
    close.MouseLeftButtonUp += close_up
    bar.MouseLeftButtonDown += drag
    bar_grid.Children.Add(close)
    bar.Child = bar_grid
    WpfGrid.SetRow(bar, 0)
    root.Children.Add(bar)

    # --- content ---
    panel = DockPanel()
    panel.Margin = Thickness(22, 4, 22, 16)
    intro = TextBlock()
    intro.Text, intro.TextWrapping = message, TextWrapping.Wrap
    intro.Foreground = ui_brush('#6E6E73')
    intro.Margin = Thickness(0, 0, 0, 14)
    DockPanel.SetDock(intro, Dock.Top)
    panel.Children.Add(intro)
    WpfGrid.SetRow(panel, 1)
    root.Children.Add(panel)

    # --- bottom button bar ---
    footer = Border()
    footer.CornerRadius = CornerRadius(0, 0, 12, 12)
    footer.Background = ui_brush('#F5F5F7')
    footer.BorderBrush = ui_brush('#E5E5EA')
    footer.BorderThickness = Thickness(0, 1, 0, 0)
    footer.Padding = Thickness(22, 12, 22, 12)
    foot = DockPanel()
    left = StackPanel()
    left.Orientation = Orientation.Horizontal
    left.VerticalAlignment = VerticalAlignment.Center
    DockPanel.SetDock(left, Dock.Left)
    foot.Children.Add(left)
    buttons = StackPanel()
    buttons.Orientation = Orientation.Horizontal
    buttons.HorizontalAlignment = System.Windows.HorizontalAlignment.Right
    buttons.Tag = left
    foot.Children.Add(buttons)
    footer.Child = foot
    WpfGrid.SetRow(footer, 2)
    root.Children.Add(footer)

    shell.Child = root
    win.Content = shell
    return win, panel, buttons


def make_button(text, action, default=False, cancel=False, kind=None, glyph=None):
    """kind: None (gray), 'primary' (blue), 'danger' (red), 'link' (text)."""
    b = Button()
    b.Content = btn_content(glyph, text) if glyph else text
    b.Padding = Thickness(14, 6, 14, 6)
    b.IsDefault, b.IsCancel = default, cancel
    AutomationProperties.SetName(b, text)
    if action is not None:
        b.Click += action
    if kind == 'primary':
        b.Background, b.Foreground = ui_brush('#007AFF'), ui_brush('#FFFFFF')
        b.FontWeight = System.Windows.FontWeights.SemiBold
    elif kind == 'danger':
        b.Background, b.Foreground = ui_brush('#FFE9E7'), ui_brush('#D70015')
        b.FontWeight = System.Windows.FontWeights.SemiBold
    elif kind == 'link':
        b.Background, b.Foreground = Brushes.Transparent, ui_brush('#007AFF')
    return b


def button(panel, text, action, default=False, cancel=False, kind=None, glyph=None):
    b = make_button(text, action, default, cancel, kind, glyph)
    b.Margin = Thickness(8, 0, 0, 0)
    panel.Children.Add(b)
    return b


def choose(caption, message, choices, multi=False, checked=False, preset=None, owner=None):
    if not choices:
        fail(u'No items available: ' + caption)
    win, panel, buttons = window(caption, message)
    if owner is not None:
        win.Owner = owner
    search_host, search, clear = ui_search(u'Search by name or number')
    search_host.Margin = Thickness(0, 0, 0, 8)
    count = TextBlock()
    count.FontSize, count.Foreground = 12, ui_brush('#8E8E93')
    count.Margin = Thickness(2, 0, 0, 8)
    top = StackPanel()
    top.Children.Add(search_host)
    top.Children.Add(count)
    DockPanel.SetDock(top, Dock.Top)
    panel.Children.Add(top)
    box = ListBox()
    box.SelectionMode = SelectionMode.Single
    AutomationProperties.SetName(box, caption)
    entries = []
    def refresh_count(sender=None, args=None):
        count.Text = (u'Sheets selected: {}'.format(sum(1 for row, control, text, value in entries if control and control.IsChecked))
                      if multi else u'Select a row and click "Next".')
    for text, value in choices:
        row = ListBoxItem()
        row.Tag = value
        row.Padding = Thickness(10, 7, 10, 7)
        if multi:
            control = CheckBox()
            control.Content = text
            control.IsChecked = bool(checked) or bool(preset is not None and preset(value))
            control.Checked += refresh_count
            control.Unchecked += refresh_count
            AutomationProperties.SetName(control, text)
            row.Content = control
        else:
            control = None
            row.Content = text
        box.Items.Add(row)
        entries.append((row, control, text, value))
    def filter_choices(sender, args):
        query = search.Text.strip().lower()
        for row, control, text, value in entries:
            row.Visibility = Visibility.Visible if query in text.lower() else Visibility.Collapsed
        if box.SelectedItem and box.SelectedItem.Visibility != Visibility.Visible:
            box.SelectedIndex = -1
    search.TextChanged += filter_choices
    refresh_count()
    if not multi:
        box.SelectedIndex = 0
    panel.Children.Add(ui_card(box, padding=4, gap=0))
    result = []

    def accept(sender, args):
        selected = ([value for row, control, text, value in entries if control.IsChecked]
                    if multi else [row.Tag for row in box.SelectedItems])
        if not selected:
            TaskDialog.Show(caption, u'Select at least one item.')
            return
        result.extend(selected)
        win.DialogResult = True
    button(buttons, u'Cancel', lambda s, a: win.Close(), cancel=True)
    button(buttons, u'Next', accept, default=True, kind='primary')
    search.Focus()
    if not win.ShowDialog():
        raise Cancelled()
    return result if multi else result[0]


def fields(caption, message, specs):
    """Specs: key, label, initial string or (choices, initial value), multiline."""
    win, panel, buttons = window(caption, message)
    stack = StackPanel()
    panel.Children.Add(scroll_content(ui_card(stack, padding=16, gap=0)))
    controls = {}
    for key, label, initial, multiline in specs:
        lab = Label()
        lab.Content = label
        stack.Children.Add(lab)
        if isinstance(initial, tuple):
            control = ComboBox()
            for display, value in initial[0]:
                option = ComboBoxItem()
                option.Content, option.Tag = display, value
                control.Items.Add(option)
                if value == initial[1]:
                    control.SelectedIndex = control.Items.Count - 1
        else:
            control = TextBox()
            control.Text = initial
            control.AcceptsReturn = multiline
            control.TextWrapping = TextWrapping.Wrap if multiline else TextWrapping.NoWrap
            if multiline:
                control.MinHeight = 95
                control.VerticalScrollBarVisibility = System.Windows.Controls.ScrollBarVisibility.Auto
        control.MinHeight = 34
        control.Margin = Thickness(0, 0, 0, 10)
        lab.Target = control
        AutomationProperties.SetName(control, label)
        stack.Children.Add(control)
        controls[key] = control
    result = {}

    def accept(sender, args):
        for key, control in controls.items():
            if isinstance(control, ComboBox):
                if control.SelectedItem is None:
                    TaskDialog.Show(caption, u'Select a value in each list.')
                    control.Focus()
                    return
                result[key] = control.SelectedItem.Tag
            else:
                result[key] = control.Text.strip()
        win.DialogResult = True
    button(buttons, u'Cancel', lambda s, a: win.Close(), cancel=True)
    button(buttons, u'Next', accept, default=True, kind='primary')
    if not win.ShowDialog():
        raise Cancelled()
    return result


def show_report(caption, text, can_save=False, incomplete=False):
    win, panel, buttons = window(caption, u'Report.')
    box = TextBox()
    box.Text, box.IsReadOnly, box.AcceptsReturn = text, True, True
    box.TextWrapping = TextWrapping.Wrap
    box.VerticalScrollBarVisibility = System.Windows.Controls.ScrollBarVisibility.Auto
    box.BorderThickness = Thickness(0)
    box.Background = Brushes.Transparent
    box.FontSize = 12
    try:
        from System.Windows.Media import FontFamily
        box.FontFamily = FontFamily(u'Cascadia Mono, Consolas, Segoe UI')
    except Exception:
        pass
    AutomationProperties.SetName(box, u'Report')
    left = buttons.Tag
    copy_button = button(left, u'Copy report', lambda s, a: Clipboard.SetText(text), kind='link', glyph=u'\\uE8C8')
    copy_button.Margin = Thickness(-8, 0, 0, 0)
    button(buttons, u'Close', lambda s, a: win.Close(), cancel=True)
    panel.Children.Add(ui_card(box, padding=10, gap=0))
    win.ShowDialog()
    return False


def placements(sheet):
    result = []
    for ident in sheet.GetAllViewports():
        port = doc.GetElement(ident)
        result.append((port, doc.GetElement(port.ViewId)))
    for inst in FilteredElementCollector(doc).OwnedByView(sheet.Id).OfClass(ScheduleSheetInstance):
        if not inst.IsTitleblockRevisionSchedule:
            result.append((inst, doc.GetElement(inst.ScheduleId)))
    return result


def elements_in_crop(view, items):
    """Fallback for sections/elevations: items whose box overlaps the view's crop volume."""
    box = view.CropBox
    inverse = box.Transform.Inverse
    tol = 5.0/304.8
    found = []
    for item in items:
        low, high = bounds([item], inverse)
        if (high.X >= box.Min.X-tol and low.X <= box.Max.X+tol and high.Y >= box.Min.Y-tol and low.Y <= box.Max.Y+tol and
                high.Z >= box.Min.Z-tol and low.Z <= box.Max.Z+tol and not item.IsHidden(view)):
            found.append(item)
    return found


def visible_elements(view, items):
    if not items:
        return []
    wanted = List[ElementId]([s.Id for s in items])
    ids = set(id_value(x) for x in ids_in_view(view.Id, wanted))
    found = [s for s in items if eid(s) in ids and not s.IsHidden(view)]
    if isinstance(view, DB.ViewSection) and len(found) < len(items):
        try:
            found_ids = set(eid(s) for s in found)
            in_crop = elements_in_crop(view, [s for s in items if eid(s) not in found_ids])
            for s in in_crop:
                if eid(s) not in found_ids:
                    found.append(s)
        except Exception:
            pass
    return found


def plan_range_abs(view):
    """Absolute (internal) Z of a plan's view range planes: [top, cut, bottom, depth]; None = unlimited."""
    vr = view.GetViewRange()
    try:
        out = []
        for name in ('TopClipPlane', 'CutPlane', 'BottomClipPlane', 'ViewDepthPlane'):
            plane = getattr(DB.PlanViewPlane, name)
            lev_id = vr.GetLevelId(plane)
            level = doc.GetElement(lev_id) if id_value(lev_id) >= 0 else None
            out.append(None if level is None else level.Elevation + vr.GetOffset(plane))
        return out
    finally:
        vr.Dispose()


def box_points(box):
    return [box.Transform.OfPoint(XYZ(x, y, z)) for x in (box.Min.X, box.Max.X)
            for y in (box.Min.Y, box.Max.Y) for z in (box.Min.Z, box.Max.Z)]


def bounds(items, transform=None):
    transform = transform or Transform.Identity
    points = [transform.OfPoint(p) for item in items for p in box_points(item.get_BoundingBox(None))]
    if not points:
        fail(u'Could not read the element bounding boxes.')
    return XYZ(min(p.X for p in points), min(p.Y for p in points), min(p.Z for p in points)), XYZ(max(p.X for p in points), max(p.Y for p in points), max(p.Z for p in points))


def center(items):
    low, high = bounds(items)
    return low.Add(high).Multiply(0.5)


def mm(value):
    return int(round(value * 304.8))


FAR_CLIP_GROW_MAX = 2500.0   # mm: the far clip of a new section may grow by at most this much to reach its elements


def section_depth_fix(view, items):
    """A new section can be cut too shallow. Widen only the depth; never flip the viewing side."""
    try:
        box = view.CropBox
        low, high = bounds(items, box.Transform.Inverse)
        tol = 5.0 / 304.8
        inside_xy = (high.X >= box.Min.X - tol and low.X <= box.Max.X + tol and
                     high.Y >= box.Min.Y - tol and low.Y <= box.Max.Y + tol)
        if not inside_xy:
            return False
        if high.Z < box.Min.Z - tol and (box.Min.Z - low.Z) > FAR_CLIP_GROW_MAX / 304.8:
            return False      # far beyond the far clip: that is another room, not a shallow section
        margin = 50.0 / 304.8
        # a item deeper than the far clip (Z below Min, the camera looks toward -Z) only needs a deeper far clip;
        # the viewing side is never flipped
        new_min, new_max = min(box.Min.Z, low.Z - margin), max(box.Max.Z, high.Z + margin)
        if new_min == box.Min.Z and new_max == box.Max.Z:
            return False
        box.Min = XYZ(box.Min.X, box.Min.Y, new_min)
        box.Max = XYZ(box.Max.X, box.Max.Y, new_max)
        view.CropBox = box
        view.CropBoxActive = True
        return True
    except Exception:
        return False


def plan_range_fix(view, items):
    """A new plan can cut the target items off with its (copied) View Range. Widen only the range: raise Top
    and lower Bottom / View Depth to the items; the Cut plane, level and crop stay as they are."""
    try:
        level = view.GenLevel
        if level is None:
            return False
        low, high = bounds(items)
        margin = 50.0 / 304.8
        need_top, need_bottom = high.Z + margin, low.Z - margin
        base = level.Elevation
        top, cut, bottom, depth = plan_range_abs(view)
        vr = view.GetViewRange()
        try:
            changed = False
            if top is not None and top < need_top:
                vr.SetLevelId(DB.PlanViewPlane.TopClipPlane, level.Id)
                vr.SetOffset(DB.PlanViewPlane.TopClipPlane, need_top - base)
                changed = True
            if bottom is not None and bottom > need_bottom:
                vr.SetLevelId(DB.PlanViewPlane.BottomClipPlane, level.Id)
                vr.SetOffset(DB.PlanViewPlane.BottomClipPlane, need_bottom - base)
                bottom = need_bottom
                changed = True
            if depth is not None and bottom is not None and depth > bottom:
                vr.SetLevelId(DB.PlanViewPlane.ViewDepthPlane, level.Id)
                vr.SetOffset(DB.PlanViewPlane.ViewDepthPlane, bottom - base)
                changed = True
            if changed:
                view.SetViewRange(vr)
            return changed
        finally:
            vr.Dispose()
    except Exception:
        return False


def explain_hidden(view, missing):
    """Human-readable reasons why the new view does not show the target elements."""
    lines = []
    try:
        wanted = List[ElementId]([s.Id for s in missing])
        in_view = set(id_value(x) for x in ids_in_view(view.Id, wanted))
        absent = [s for s in missing if eid(s) not in in_view]
        lines.append(u'Revit does not return {} of {} items in the view.'.format(len(absent), len(missing)))
    except Exception:
        pass
    try:
        hidden = [s for s in missing if s.IsHidden(view)]
        if hidden:
            lines.append(u'Hidden in the view itself (Hide/Isolate): {} of {}.'.format(len(hidden), len(missing)))
    except Exception:
        pass
    try:
        names = set()
        for s in missing:
            if s.Category is not None and view.GetCategoryHidden(s.Category.Id):
                names.add(s.Category.Name)
        for name in sorted(names):
            lines.append(u'Category "{}" is hidden in the view (Visibility/Graphics).'.format(name))
    except Exception:
        pass
    try:
        if doc.IsWorkshared:
            bad = [s for s in missing if view.GetWorksetVisibility(s.WorksetId) == DB.WorksetVisibility.Hidden]
            if bad:
                lines.append(u'Workset of {} items is turned off in the view.'.format(len(bad)))
    except Exception:
        pass
    try:
        if isinstance(view, DB.ViewSection):
            box = view.CropBox
            low, high = bounds(missing, box.Transform.Inverse)
            lines.append(u'Section, in view coordinates (mm). Elements: X {}…{}, Y {}…{}, depth {}…{}. '
                         u'View crop: X {}…{}, Y {}…{}, depth {}…{}.'.format(
                mm(low.X), mm(high.X), mm(low.Y), mm(high.Y), mm(low.Z), mm(high.Z),
                mm(box.Min.X), mm(box.Max.X), mm(box.Min.Y), mm(box.Max.Y), mm(box.Min.Z), mm(box.Max.Z)))
            if high.Z < box.Min.Z:
                lines.append(u'Elements are beyond the far clip of the section (Far Clip) by {} mm: increase the view depth. '
                             u'If this is more than {} mm, check that the right elements are selected.'.format(
                                 mm(box.Min.Z - high.Z), int(FAR_CLIP_GROW_MAX)))
            elif low.Z > box.Max.Z:
                lines.append(u'Elements lie IN FRONT OF the section plane (behind the camera): the section seems to look from the opposite side. '
                             u'Choose the opposite side.')
            elif high.X < box.Min.X or low.X > box.Max.X or high.Y < box.Min.Y or low.Y > box.Max.Y:
                lines.append(u'Elements are outside the view crop in width/height: check the selection.')
        elif isinstance(view, DB.ViewPlan):
            vr = view.GetViewRange()
            try:
                parts = []
                for label, name in ((u'Top', 'TopClipPlane'), (u'Cut', 'CutPlane'), (u'Bottom', 'BottomClipPlane'), (u'Depth', 'ViewDepthPlane')):
                    plane = getattr(DB.PlanViewPlane, name)
                    level = doc.GetElement(vr.GetLevelId(plane))
                    base = level.ProjectElevation if level is not None else view.GenLevel.ProjectElevation
                    parts.append(u'{} {}'.format(label, mm(base + vr.GetOffset(plane))))
            finally:
                vr.Dispose()
            low, high = bounds(missing)
            lines.append(u'Plan. View Range (absolute levels, mm): {}. Elements: Z {}…{}.'.format(u', '.join(parts), mm(low.Z), mm(high.Z)))
    except Exception:
        pass
    lines.append(u'Also check Phase / Phase Filter, Design Option and view filters.')
    return lines


def isolate_elements(view, items):
    if not items:
        fail(u'Empty set of elements for the view ' + title(view))
    progress_note(u'Isolating elements in the new view…')
    doc.Regenerate()
    view.IsolateElementsTemporary(List[ElementId]([s.Id for s in items]))
    view.ConvertTemporaryHideIsolateToPermanent()
    doc.Regenerate()
    visible = set(eid(s) for s in visible_elements(view, items))
    missing = set(eid(s) for s in items) - visible
    if missing and isinstance(view, DB.ViewSection):
        wanted = [s for s in items if eid(s) in missing]
        if section_depth_fix(view, wanted):
            doc.Regenerate()
            visible = set(eid(s) for s in visible_elements(view, items))
            missing = set(eid(s) for s in items) - visible
    if missing and isinstance(view, DB.ViewPlan):
        if plan_range_fix(view, items):
            doc.Regenerate()
            visible = set(eid(s) for s in visible_elements(view, items))
            missing = set(eid(s) for s in items) - visible
    if missing:
        wanted = [s for s in items if eid(s) in missing]
        fail(u'Template or View Range hides the target items {} in view {}.\n\nDiagnostics:\n{}'.format(
            sorted(missing), title(view), u'\n'.join(explain_hidden(view, wanted))))


def is_section_like(view):
    return isinstance(view, DB.ViewSection) and view.ViewType in (ViewType.Section, ViewType.Detail, ViewType.Elevation)


# ---- ELEVATION VIEWS (real Elevation views with native markers on the key plan) ----
ELEV = {'host': None, 'made': 0, 'failed': 0, 'errors': [], 'marker': None, 'off_plan': 0}


def _flat_dir(v):
    h = XYZ(v.X, v.Y, 0.0)
    return h.Normalize() if h.GetLength() > 1e-9 else None


def elevation_type_for(hint_id=None):
    """Elevation ViewFamilyType: the one of the reference when given, else interior-like, else the first."""
    kinds = [t for t in FilteredElementCollector(doc).OfClass(DB.ViewFamilyType) if t.ViewFamily == DB.ViewFamily.Elevation]
    if not kinds:
        return None
    if hint_id is not None:
        for t in kinds:
            if t.Id == hint_id:
                return t
    for t in kinds:
        if any(k in (title(t) or u'').lower() for k in (u'interior', u'\u0432\u043d\u0443\u0442\u0440', u'\u0440\u0430\u0437\u0432\u0435\u0440\u0442', u'\u0440\u043e\u0437\u0433\u043e\u0440\u0442')):
            return t
    return kinds[0]


def _depth_sign(view, cam):
    """+1 when the depth of the view (what it shows) extends from the camera toward +Z of its crop box, -1 toward -Z.
    Read from the crop box itself, measured from the camera `cam` (the origin of the view need not be at the marker)."""
    try:
        box = view.CropBox
        zc = box.Transform.Inverse.OfPoint(XYZ(cam.X, cam.Y, cam.Z)).Z
        return 1.0 if (box.Max.Z - zc) > (zc - box.Min.Z) + 1e-6 else -1.0
    except Exception:
        return -1.0


def build_elevation(section, host, hint_id=None, offset_mm=600.0, at=None):
    """Creates a real Elevation (marker on `host` plan + CreateElevation) with the same orientation and crop as
    `section`. Runs inside the caller's (Sub)Transaction; the caller rolls back on any exception.
    Orientation is matched by the view's RIGHT direction, so it does not depend on ViewDirection sign conventions.
    `at` = (x, y) in mm: the marker stands exactly there (the bubble of the layout preview); without it the marker stands
    `offset_mm` in front of the middle of the view."""
    if host is None or not isinstance(host, DB.ViewPlan) or host.GenLevel is None:
        raise ValueError(u'there is no plan for the Elevation markers')
    etype = elevation_type_for(hint_id)
    if etype is None:
        raise ValueError(u'the project has no Elevation view type')
    doc.Regenerate()
    box = section.CropBox
    tr = box.Transform
    right = _flat_dir(tr.BasisX)
    toward = _flat_dir(tr.BasisZ)
    if right is None or toward is None:
        raise ValueError(u'the view is not vertical')
    mid = tr.OfPoint(XYZ((box.Min.X + box.Max.X) / 2.0, (box.Min.Y + box.Max.Y) / 2.0, 0.0))
    d = offset_mm / 304.8
    if at is not None:
        point = XYZ(at[0] / 304.8, at[1] / 304.8, host.GenLevel.Elevation)
    else:
        point = XYZ(mid.X + toward.X * d, mid.Y + toward.Y * d, host.GenLevel.Elevation)
    try:
        scale = int(section.Scale)
    except Exception:
        scale = 20
    marker = DB.ElevationMarker.CreateElevationMarker(doc, etype.Id, point, scale)
    ELEV['marker'] = marker.Id
    view = marker.CreateElevation(doc, host.Id, 0)
    doc.Regenerate()
    cur = _flat_dir(view.CropBox.Transform.BasisX)
    if cur is None:
        raise ValueError(u'Revit did not return the direction of the new Elevation')
    angle = math.atan2(right.Y, right.X) - math.atan2(cur.Y, cur.X)
    if abs(angle) > 1e-6:
        axis = DB.Line.CreateBound(point, point.Add(XYZ(0, 0, 1)))
        DB.ElementTransformUtils.RotateElement(doc, marker.Id, axis, angle)
        doc.Regenerate()
    vt = view.CropBox.Transform
    got = _flat_dir(vt.BasisX)
    if got is None or got.DotProduct(right) < 0.999:
        raise ValueError(u'could not orient the Elevation marker along the view direction')
    centre = box.Transform.OfPoint(XYZ((box.Min.X + box.Max.X) / 2.0, (box.Min.Y + box.Max.Y) / 2.0, (box.Min.Z + box.Max.Z) / 2.0))
    # Z of the camera (the marker) in the view's own coordinates. The origin of an Elevation is not necessarily at the
    # marker, so "behind the camera" is measured from the marker, never from Z = 0.
    cam = point
    sign = _depth_sign(view, cam)

    def cam_z(transform):
        return transform.Inverse.OfPoint(XYZ(cam.X, cam.Y, cam.Z)).Z

    def behind(transform):
        # the wall centre must lie ahead of the camera, in the direction the view looks (depth side)
        return (transform.Inverse.OfPoint(centre).Z - cam_z(transform)) * sign < -1e-6

    if behind(vt) and at is not None:
        z = vt.BasisZ
        cb = view.CropBox
        raise ValueError(u'the marker with this layout does not face the wall (change ⇄ in the layout) [wall center behind the camera by {:.0f} mm; depth={:+.0f}; BasisZ=({:.2f}; {:.2f}); crop Z=({:.0f}; {:.0f}) mm]'.format(
            -(vt.Inverse.OfPoint(centre).Z - cam_z(vt)) * sign * 304.8, sign, z.X, z.Y, cb.Min.Z * 304.8, cb.Max.Z * 304.8))
    if behind(vt):
        # the wall is behind the camera: the marker stands on the wrong side, move it to the other one
        DB.ElementTransformUtils.MoveElement(doc, marker.Id, XYZ(-2.0 * toward.X * d, -2.0 * toward.Y * d, 0.0))
        cam = XYZ(point.X - 2.0 * toward.X * d, point.Y - 2.0 * toward.Y * d, point.Z)
        doc.Regenerate()
        vt = view.CropBox.Transform
        sign = _depth_sign(view, cam)
        if behind(vt):
            raise ValueError(u'the wall ended up behind the Elevation camera')
    inv = vt.Inverse
    corners = [XYZ(x, y, z) for x in (box.Min.X, box.Max.X) for y in (box.Min.Y, box.Max.Y) for z in (box.Min.Z, box.Max.Z)]
    pts = [inv.OfPoint(tr.OfPoint(c)) for c in corners]
    crop = view.CropBox
    lo_x, hi_x = min(p.X for p in pts), max(p.X for p in pts)
    lo_y, hi_y = min(p.Y for p in pts), max(p.Y for p in pts)
    zc = cam_z(vt)
    if sign < 0:
        far = min(p.Z for p in pts)
        crop.Min = XYZ(lo_x, lo_y, far if far < zc - 1e-3 else zc - 1.0)
        crop.Max = XYZ(hi_x, hi_y, zc)
    else:
        far = max(p.Z for p in pts)
        crop.Min = XYZ(lo_x, lo_y, zc)
        crop.Max = XYZ(hi_x, hi_y, far if far > zc + 1e-3 else zc + 1.0)
    view.CropBox = crop
    try:
        view.CropBoxActive = True
    except Exception:
        pass
    doc.Regenerate()
    back = view.CropBox
    if abs((back.Max.X - back.Min.X) - (hi_x - lo_x)) > 5.0 / 304.8 or abs((back.Max.Y - back.Min.Y) - (hi_y - lo_y)) > 5.0 / 304.8:
        raise ValueError(u'Revit changed the size of the Elevation crop')
    return view


def upgrade_to_elevation(section, hint_id=None, at=None):
    """Replaces a just created Section by a real Elevation of the same crop. Returns the Elevation, or None
    (everything is rolled back and the Section stays) when anything goes wrong."""
    host = ELEV['host']
    sub = SubTransaction(doc)
    sub.Start()
    try:
        view = build_elevation(section, host, hint_id, at=at)
        doc.Delete(section.Id)
        if sub.Commit() != TransactionStatus.Committed:
            raise ValueError(u'Revit rolled back the Elevation creation')
        ELEV['made'] += 1
        return view
    except (Cancelled, OperationCanceledException):
        if sub.GetStatus() == TransactionStatus.Started:
            sub.RollBack()
        raise
    except Exception as exc:
        if sub.GetStatus() == TransactionStatus.Started:
            sub.RollBack()
        try:
            print(u'[elevation] ' + traceback.format_exc())
        except Exception:
            pass
        if at is not None:
            # the layout point did not work: the marker goes next to the wall as before, and the report says so
            ELEV['off_plan'] += 1
            text = u'could not place the marker at the layout point ({}); placed near the wall'.format(err_text(exc))
            if text not in ELEV['errors'] and len(ELEV['errors']) < 5:
                ELEV['errors'].append(text)
            return upgrade_to_elevation(section, hint_id, None)
        ELEV['failed'] += 1
        text = err_text(exc) + err_where()
        if text not in ELEV['errors'] and len(ELEV['errors']) < 5:
            ELEV['errors'].append(text)
        return None
    finally:
        sub.Dispose()


def configure_view_soft(source, target):
    """Like configure_view, but each step may fail on its own (Section style applied to an Elevation)."""
    for step in (lambda: setattr(target, 'ViewTemplateId', ElementId.InvalidElementId),
                 lambda: target.ApplyViewTemplateParameters(source),
                 lambda: setattr(target, 'Scale', source.Scale),
                 lambda: setattr(target, 'DetailLevel', source.DetailLevel),
                 lambda: setattr(target, 'DisplayStyle', source.DisplayStyle)):
        try:
            step()
        except Exception:
            pass
    try:
        scope = target.get_Parameter(BuiltInParameter.VIEWER_VOLUME_OF_INTEREST_CROP)
        if scope and not scope.IsReadOnly:
            scope.Set(ElementId.InvalidElementId)
    except Exception:
        pass


# 0.5 workflow UI. All saved state contains UniqueIds and text, never API objects.
from System.Windows.Controls import Border, TabControl, TabItem, ScrollBarVisibility, Grid as WpfGrid, ColumnDefinition, RowDefinition
from System.Windows.Controls.Primitives import UniformGrid


def fit_window(win):
    area = System.Windows.SystemParameters.WorkArea
    win.Width = min(win.Width, max(480, area.Width - 48))
    win.Height = min(win.Height, max(360, area.Height - 64))
    win.MinWidth = min(560, win.Width)
    win.MinHeight = min(400, win.Height)


def scroll_content(content):
    scroll = ScrollViewer()
    scroll.VerticalScrollBarVisibility = ScrollBarVisibility.Auto
    scroll.HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled
    scroll.Content = content
    return scroll


PROGRESS = None
import time as _time


def progress_note(text):
    if PROGRESS is not None:
        PROGRESS.note(text)


def clean_name(value):
    # Revit's object-name restrictions; API validation below remains authoritative.
    return re.sub(r'\s+', ' ', re.sub(r'[\\:{}\[\]|;<>?`~\x00-\x1f]', ' - ', value or '')).strip()


def free_name(value, occupied):
    base = clean_name(value) or 'View'
    used = set(x.strip().lower() for x in occupied)
    candidate, suffix = base, 2
    while candidate.lower() in used:
        candidate = base + ' - ' + str(suffix)
        suffix += 1
    return candidate


from System.Windows.Input import Key, Keyboard
from System.Windows.Media import BrushConverter


def ui_brush(value):
    return BrushConverter().ConvertFromString(value)


# -*- coding: utf-8 -*-
import re as _re
import math as _math


from System.Windows.Shapes import Line as WLine, Polygon as WPolygon, Ellipse as WEllipse
from System.Windows import Point as WPoint
from System.Windows.Media import PointCollection, PixelFormats
from System.Windows.Media.Imaging import RenderTargetBitmap, PngBitmapEncoder, BitmapFrame

_MM = 304.8


from Autodesk.Revit.Exceptions import RegenerationFailedException, ModificationForbiddenException


CLEAN_FRONT = 100.0/304.8      # the cut plane of a clean elevation stands 100 mm in front of the elements
CLEAN_CONV = {'v': 1}          # +1: a section looks along -BasisZ (checked on the first view, then remembered)


def sheet_view_slots(sheet):
    """(viewport, view) pairs of a sheet that hold plans/elevations: not legends, not schedules."""
    found = []
    for p, v in placements(sheet):
        if isinstance(p, Viewport) and not isinstance(v, ViewSchedule) and v.ViewType != ViewType.Legend:
            found.append((p, v))
    return found


def _clean_box(side, items, conv, span=None):
    """Crop box of an elevation of `side` seen from the room: x along the wall, y up, depth behind the cut plane."""
    n = side['n']
    nrm = XYZ(n[0], n[1], 0.0).Normalize()
    tr = Transform.Identity
    tr.BasisZ = nrm.Multiply(conv)
    tr.BasisY = XYZ.BasisZ
    tr.BasisX = tr.BasisY.CrossProduct(tr.BasisZ)
    tr.Origin = XYZ(side['c'][0]/_MM, side['c'][1]/_MM, 0.0)
    low, high = bounds(items, tr.Inverse)
    near = high.Z if conv > 0 else -low.Z          # the face nearest to the viewer, along the room normal
    tr.Origin = tr.Origin.Add(nrm.Multiply(near + CLEAN_FRONT))
    low, high = bounds(items, tr.Inverse)
    if span:
        # the wall and its base are drawn over the same width, so they line up on the sheet
        s_low, s_high = bounds(span, tr.Inverse)
        low = XYZ(min(low.X, s_low.X), low.Y, low.Z)
        high = XYZ(max(high.X, s_high.X), high.Y, high.Z)
    m, depth = 150.0/_MM, 50.0/_MM
    box = DB.BoundingBoxXYZ()
    box.Transform = tr
    if conv > 0:
        box.Min, box.Max = XYZ(low.X - m, low.Y - m, low.Z - depth), XYZ(high.X + m, high.Y + m, 0.0)
    else:
        box.Min, box.Max = XYZ(low.X - m, low.Y - m, 0.0), XYZ(high.X + m, high.Y + m, high.Z + depth)
    return box


def _add_port(sheet, view, type_id, center):
    if not Viewport.CanAddViewToSheet(doc, sheet.Id, view.Id):
        fail(u'The view cannot be placed: ' + title(view))
    port = Viewport.Create(doc, sheet.Id, view.Id, center)
    if type_id is not None:
        port.ChangeTypeId(type_id)
    doc.Regenerate()
    return port


def _marker_of_view(host, view):
    """(marker, slot) of the Elevation marker that holds `view`, or (None, None). The whole document is searched, not only
    what `host` shows: a marker hidden on the plan (base views) or outside its crop is not returned by a view collector.
    ElevationMarker has no owner view, so it is matched only by the view it holds."""
    for marker in FilteredElementCollector(doc).OfClass(DB.ElevationMarker):
        for slot in range(4):
            try:
                if marker.GetViewId(slot) == view.Id:
                    return marker, slot
            except Exception:
                continue
    return None, None


def _marker_plan_and_centre(marker, host):
    """(host, centre XYZ) of the marker's box on `host`, or (None, None) when `host` does not show it. Only `host` is
    asked: a box on any other plan makes Revit generate that plan's graphics, which takes minutes per plan in a big
    project. The centre is the middle of the box (view.Origin of an Elevation is NOT the marker point)."""
    try:
        bb = marker.get_BoundingBox(host)
    except Exception:
        bb = None
    if bb is None:
        return None, None
    return host, XYZ((bb.Min.X + bb.Max.X) / 2.0, (bb.Min.Y + bb.Max.Y) / 2.0, (bb.Min.Z + bb.Max.Z) / 2.0)


# --- ELEVATION MARKERS: align rotation · move marker keeping the view in place ----
MK_STEP_DEG = 90.0              # step to which the view direction is aligned (measured from the project X axis)
MK_MAX_DEV_DEG = 1.0            # deviation larger than this is an intentional angle: the marker is left alone, only reported
MK_KEEP_TOL_FT = 2.0 / 304.8    # tolerance: how far the view may fail to return to its place after the marker is moved (2 mm)


class ElevationMarkerFilter(ISelectionFilter):
    def AllowElement(self, element):
        return isinstance(element, DB.ElevationMarker) or (
            isinstance(element, DB.ViewSection) and element.ViewType == ViewType.Elevation)

    def AllowReference(self, reference, point):
        return False


def _active_plan():
    host = uidoc.ActiveView
    if not (isinstance(host, DB.ViewPlan) and not host.IsTemplate):
        fail(u'Open a plan (key plan) where the Elevation markers are visible.')
    return host


def _markers_of_selection(host, prompt, allow_pick=True):
    """Elevation markers from the Revit selection: the markers themselves and markers of the selected Elevation views (duplicates removed).
    Without a selection — pick on the plan."""
    elements = [doc.GetElement(i) for i in uidoc.Selection.GetElementIds()]
    if not any(isinstance(e, (DB.ElevationMarker, DB.ViewSection)) for e in elements):
        if not allow_pick:
            fail(u'Select an Elevation marker on the plan.')
        refs = uidoc.Selection.PickObjects(ObjectType.Element, ElevationMarkerFilter(), prompt)
        elements = [doc.GetElement(r.ElementId) for r in refs]
    markers, seen = [], set()
    for e in elements:
        m = None
        if isinstance(e, DB.ElevationMarker):
            m = e
        elif isinstance(e, DB.ViewSection) and e.ViewType == ViewType.Elevation:
            m, unused = _marker_of_view(host, e)
        if m is not None and id_value(m.Id) not in seen:
            seen.add(id_value(m.Id))
            markers.append(m)
    if not markers:
        fail(u'There are no Elevation markers in the selection.')
    return markers


def _marker_views(marker):
    views = []
    for slot in range(4):
        try:
            vid = marker.GetViewId(slot)
        except Exception:
            continue
        v = doc.GetElement(vid) if vid is not None else None
        if isinstance(v, DB.View):
            views.append(v)
    return views


def _marker_label(marker, views):
    return title(views[0]) if views else u'marker {}'.format(id_value(marker.Id))


def snap_elevation_markers():
    """Brings the view direction of the selected markers to the nearest MK_STEP_DEG step (rotation around the marker center).
    Deviation larger than MK_MAX_DEV_DEG is left alone: it is an intentional angle."""
    host = _active_plan()
    try:
        markers = _markers_of_selection(host, u'Select Elevation markers to align, then Finish')
    except OperationCanceledException:
        return u'Cancelled.'
    step = math.radians(MK_STEP_DEG)
    tol = math.radians(MK_MAX_DEV_DEG)
    done, same, skipped, failed = [], 0, [], []
    group = TransactionGroup(doc, u'Universal Toolkit: align Elevation markers')
    transaction = Transaction(doc, u'Align Elevation markers')
    group.Start()
    try:
        transaction.Start()
        for marker in markers:
            views = _marker_views(marker)
            label = _marker_label(marker, views)
            look = _flat_dir(views[0].ViewDirection) if views else None
            if look is None:
                skipped.append(u'{}: no horizontal view'.format(label))
                continue
            angle = math.atan2(look.Y, look.X)
            target = round(angle / step) * step
            delta = target - angle
            if abs(delta) < 1e-7:
                same += 1
                continue
            if abs(delta) > tol:
                skipped.append(u'{}: deviation {:.2f}° is more than {}° — left untouched'.format(
                    label, math.degrees(delta), MK_MAX_DEV_DEG))
                continue
            plan, centre = _marker_plan_and_centre(marker, host)
            if centre is None:
                skipped.append(u'{}: the marker is not on this plan'.format(label))
                continue
            sub = SubTransaction(doc)
            sub.Start()
            try:
                axis = DB.Line.CreateBound(centre, centre.Add(XYZ(0, 0, 1)))
                DB.ElementTransformUtils.RotateElement(doc, marker.Id, axis, delta)
                doc.Regenerate()
                got = _flat_dir(views[0].ViewDirection)
                want = XYZ(math.cos(target), math.sin(target), 0.0)
                if got is None or got.DotProduct(want) < 0 or abs(got.X * want.Y - got.Y * want.X) > 1e-6:
                    raise ValueError(u'view direction did not become straight — rolled back')
                sub.Commit()
                done.append(u'{}: {:+.3f}°'.format(label, math.degrees(delta)))
            except Exception as exc:
                if sub.GetStatus() == TransactionStatus.Started:
                    sub.RollBack()
                failed.append(u'{}: {}{}'.format(label, err_text(exc), err_where()))
            finally:
                sub.Dispose()
        if transaction.Commit() != TransactionStatus.Committed:
            fail(u'Revit rolled back the transaction.')
        group.Assimilate()
    except Exception:
        if transaction.GetStatus() == TransactionStatus.Started:
            transaction.RollBack()
        if group.GetStatus() == TransactionStatus.Started:
            group.RollBack()
        raise
    finally:
        transaction.Dispose()
        group.Dispose()
    text = u'Aligned: {}. Already straight: {}. Step {}°.\n\n'.format(len(done), same, MK_STEP_DEG)
    if done:
        text += u'Fixed (rotation):\n' + u'\n'.join(done) + u'\n\n'
    if skipped:
        text += u'Skipped:\n' + u'\n'.join(skipped) + u'\n\n'
    if failed:
        text += u'NOT changed (left as they were):\n' + u'\n'.join(failed) + u'\n\n'
    show_report(u'Align Elevation markers', text)
    return u'Markers aligned: {}. Already straight: {}.'.format(len(done), same) + (u' Not changed: {}.'.format(len(failed)) if failed else u'')


def _world_corners(box):
    return [box.Transform.OfPoint(XYZ(x, y, z)) for x in (box.Min.X, box.Max.X)
            for y in (box.Min.Y, box.Max.Y) for z in (box.Min.Z, box.Max.Z)]


def _keep_view_in_place(view, corners):
    """After a marker is shifted, Revit drags its view along. Here the CropBox is rewritten in the new coordinates so that its world
    corners (crop and section plane — the blue line) end up where they were. Returns the largest failure to return (feet)."""
    inv = view.CropBox.Transform.Inverse
    pts = [inv.OfPoint(c) for c in corners]
    crop = view.CropBox
    crop.Min = XYZ(min(p.X for p in pts), min(p.Y for p in pts), min(p.Z for p in pts))
    crop.Max = XYZ(max(p.X for p in pts), max(p.Y for p in pts), max(p.Z for p in pts))
    view.CropBox = crop
    doc.Regenerate()
    worst = 0.0
    for a, b in zip(corners, _world_corners(view.CropBox)):
        worst = max(worst, a.DistanceTo(b))
    return worst


def _owned_snapshot(view):
    """{id: (ElementId, XYZ min)} of annotations that belong to this view (text, dimensions, lines, markers…)."""
    snap = {}
    try:
        for el in FilteredElementCollector(doc).WherePasses(DB.ElementOwnerViewFilter(view.Id)):
            try:
                bb = el.get_BoundingBox(view)
                if bb is not None:
                    snap[id_value(el.Id)] = (el.Id, bb.Transform.OfPoint(bb.Min))
            except Exception:
                continue
    except Exception:
        pass
    return snap


def _restore_owned(view, snap):
    """If Revit moved the view's annotations together with the view, returns them to their former place in the view plane.
    Returns (moved, restored)."""
    normal = view.ViewDirection
    moved = fixed = 0
    for key, (el_id, was) in snap.items():
        el = doc.GetElement(el_id)
        if el is None:
            continue
        try:
            bb = el.get_BoundingBox(view)
            if bb is None:
                continue
            now_min = bb.Transform.OfPoint(bb.Min)
            d = XYZ(was.X - now_min.X, was.Y - now_min.Y, was.Z - now_min.Z)
            d = d - normal.Multiply(d.DotProduct(normal))   # only in the view plane
            if d.GetLength() < 0.002:                       # ~0.6 mm
                continue
            moved += 1
            DB.ElementTransformUtils.MoveElement(doc, el_id, d)
            fixed += 1
        except Exception:
            continue
    return moved, fixed


def _move_markers_keep_views(host, markers, delta):
    """Moves markers by delta (feet, in the plan plane); views stay in place. Returns (done, failed)."""
    done, failed = [], []
    group = TransactionGroup(doc, u'Universal Toolkit: move marker, view stays')
    transaction = Transaction(doc, u'Move Elevation marker')
    group.Start()
    try:
        transaction.Start()
        for marker in markers:
            views = _marker_views(marker)
            label = _marker_label(marker, views)
            if not views:
                failed.append(u'{}: marker without views'.format(label))
                continue
            plan, before = _marker_plan_and_centre(marker, host)
            if before is None:
                failed.append(u'{}: the marker is not on this plan'.format(label))
                continue
            saved = [(v, _world_corners(v.CropBox), _owned_snapshot(v)) for v in views]
            sub = SubTransaction(doc)
            sub.Start()
            try:
                DB.ElementTransformUtils.MoveElement(doc, marker.Id, delta)
                doc.Regenerate()
                plan, now = _marker_plan_and_centre(marker, host)
                if now is None or math.hypot(now.X - before.X - delta.X, now.Y - before.Y - delta.Y) * 304.8 > 20.0:
                    raise ValueError(u'marker did not stay in the new place — rolled back')
                notes = []
                for v, corners, snap in saved:
                    worst = _keep_view_in_place(v, corners)
                    if worst > MK_KEEP_TOL_FT:
                        raise ValueError(u'view "{}" could not be kept in place (mismatch {:.1f} mm) — rolled back'.format(
                            title(v), worst * 304.8))
                    moved, fixed = _restore_owned(v, snap)
                    if moved:
                        notes.append(u'annotations moved together with the view: {}, restored: {}'.format(moved, fixed))
                sub.Commit()
                done.append(label + (u' ({})'.format(u'; '.join(notes)) if notes else u''))
            except Exception as exc:
                if sub.GetStatus() == TransactionStatus.Started:
                    sub.RollBack()
                failed.append(u'{}: {}'.format(label, err_text(exc)))
            finally:
                sub.Dispose()
        if transaction.Commit() != TransactionStatus.Committed:
            fail(u'Revit rolled back the transaction.')
        group.Assimilate()
    except Exception:
        if transaction.GetStatus() == TransactionStatus.Started:
            transaction.RollBack()
        if group.GetStatus() == TransactionStatus.Started:
            group.RollBack()
        raise
    finally:
        transaction.Dispose()
        group.Dispose()
    return done, failed


NUDGE_XAML = u'''
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Move Elevation marker" SizeToContent="WidthAndHeight" ResizeMode="NoResize"
        Topmost="True" ShowInTaskbar="False" WindowStyle="ToolWindow"
        FontFamily="Segoe UI Variable Text, Segoe UI, Arial" FontSize="13" Background="#F5F5F7">
  <StackPanel Margin="16" Width="280">
    <TextBlock TextWrapping="Wrap" Foreground="#6E6E73"
               Text="Select a marker on the plan and move it with the arrows (or the ← ↑ → ↓ keys, Shift = step ×10). The view stays in place. Each step is undone with Ctrl+Z."/>
    <Grid Margin="0,12,0,0" HorizontalAlignment="Center">
      <Grid.RowDefinitions><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/></Grid.RowDefinitions>
      <Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="Auto"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions>
      <Button x:Name="btnUp" Grid.Row="0" Grid.Column="1" Content="↑" Width="52" Height="40" Margin="2" FontSize="18"/>
      <Button x:Name="btnLeft" Grid.Row="1" Grid.Column="0" Content="←" Width="52" Height="40" Margin="2" FontSize="18"/>
      <Button x:Name="btnRight" Grid.Row="1" Grid.Column="2" Content="→" Width="52" Height="40" Margin="2" FontSize="18"/>
      <Button x:Name="btnDown" Grid.Row="2" Grid.Column="1" Content="↓" Width="52" Height="40" Margin="2" FontSize="18"/>
    </Grid>
    <StackPanel Orientation="Horizontal" Margin="0,12,0,0" HorizontalAlignment="Center">
      <TextBlock Text="Step, mm:" VerticalAlignment="Center" Margin="0,0,8,0"/>
      <ComboBox x:Name="cbStep" IsEditable="True" Width="80" Text="10">
        <ComboBoxItem Content="1"/><ComboBoxItem Content="5"/><ComboBoxItem Content="10"/>
        <ComboBoxItem Content="50"/><ComboBoxItem Content="100"/><ComboBoxItem Content="250"/>
      </ComboBox>
    </StackPanel>
    <Border BorderBrush="#E5E5EA" BorderThickness="0,1,0,0" Margin="0,14,0,10"/>
    <TextBlock Text="Two clicks (like Move): from → to" FontWeight="SemiBold"/>
    <StackPanel Orientation="Horizontal" Margin="0,6,0,0">
      <RadioButton x:Name="rbFree" Content="Free" IsChecked="True" Margin="0,0,14,0"/>
      <RadioButton x:Name="rbX" Content="Only ↔" Margin="0,0,14,0" ToolTip="Move only horizontally on screen"/>
      <RadioButton x:Name="rbY" Content="Only ↕" ToolTip="Move only vertically on screen"/>
    </StackPanel>
    <Button x:Name="btnPick" Content="Pick: from → to" Margin="0,8,0,0" Padding="10,6"/>
    <TextBlock x:Name="tbStatus" TextWrapping="Wrap" Margin="0,12,0,0" Foreground="#3C3C43" MinHeight="34"/>
  </StackPanel>
</Window>
'''

_NUDGE = [None]


class MarkerNudgePanel(object):
    """Modeless panel: moves the selected Elevation marker with arrows, with the result immediately visible in Revit.
    The view (crop and blue line) stays in place every time."""

    def __init__(self, uiapp):
        self.win = load_xaml(NUDGE_XAML)
        for n in u'btnUp btnDown btnLeft btnRight btnPick cbStep rbFree rbX rbY tbStatus'.split():
            setattr(self, n, self.win.FindName(n))
        self.handler = Handler()
        self.handler.on_error = self.set_status
        self.ev = ExternalEvent.Create(self.handler)
        self.btnUp.Click += lambda s, e: self.queue_nudge(0, 1, False)
        self.btnDown.Click += lambda s, e: self.queue_nudge(0, -1, False)
        self.btnLeft.Click += lambda s, e: self.queue_nudge(-1, 0, False)
        self.btnRight.Click += lambda s, e: self.queue_nudge(1, 0, False)
        self.btnPick.Click += lambda s, e: self.queue(self.pick_move)
        self.win.PreviewKeyDown += self.on_key
        self.win.Closed += self.on_closed
        try:
            from System.Windows import SystemParameters
            self.win.WindowStartupLocation = WindowStartupLocation.Manual
            self.win.Left = max(0.0, SystemParameters.WorkArea.Width - 340.0)
            self.win.Top = 140.0
        except Exception:
            pass
        try:
            WindowInteropHelper(self.win).Owner = uiapp.MainWindowHandle
        except Exception:
            pass
        self.win.Show()

    def set_status(self, text):
        try:
            self.tbStatus.Text = text
        except Exception:
            pass

    def on_closed(self, s, e):
        _NUDGE[0] = None

    def on_key(self, s, e):
        from System.Windows.Input import Key, Keyboard, ModifierKeys
        from System.Windows.Controls import TextBox as NudgeTextBox
        if isinstance(e.OriginalSource, NudgeTextBox):
            return
        steps = {Key.Left: (-1, 0), Key.Right: (1, 0), Key.Up: (0, 1), Key.Down: (0, -1)}
        if e.Key in steps:
            e.Handled = True
            big = (int(Keyboard.Modifiers) & int(ModifierKeys.Shift)) != 0
            self.queue_nudge(steps[e.Key][0], steps[e.Key][1], big)

    def queue(self, work):
        self.handler.queue.append((u'nudge', lambda uiapp: self.safe(uiapp, work)))
        req = self.ev.Raise()
        if req != ExternalEventRequest.Accepted and req != ExternalEventRequest.Pending:
            self.handler.queue = []
            self.set_status(u'Revit is busy (a command is active). Try again.')

    def queue_nudge(self, sx, sy, big):
        self.queue(lambda uiapp: self.nudge(uiapp, sx, sy, big))

    def safe(self, uiapp, work):
        try:
            work(uiapp)
        except OperationCanceledException:
            self.set_status(u'Cancelled.')
        except Exception as exc:
            self.set_status(u'✗ ' + err_text(exc))

    def prepare(self, uiapp):
        global uidoc, doc
        uidoc = uiapp.ActiveUIDocument
        doc = uidoc.Document if uidoc else None
        if doc is None or doc.IsFamilyDocument:
            fail(u'Open an RVT project.')
        host = _active_plan()
        markers = _markers_of_selection(host, None, False)
        right = _flat_dir(host.RightDirection)
        up = _flat_dir(host.UpDirection)
        if right is None or up is None:
            fail(u'Could not determine the screen direction of the plan.')
        return host, markers, right, up

    def step_ft(self, big):
        try:
            mm = float(unicode(self.cbStep.Text).replace(u',', u'.'))
        except Exception:
            fail(u'The step must be a number in mm.')
        if mm <= 0:
            fail(u'The step must be greater than zero.')
        return mm * (10.0 if big else 1.0) / 304.8

    def apply(self, host, markers, delta):
        done, failed = _move_markers_keep_views(host, markers, delta)
        mm = delta.GetLength() * 304.8
        if failed:
            self.set_status(u'✗ Not changed: ' + u'; '.join(failed))
        else:
            self.set_status(u'✓ Markers: {}; shift {:.1f} mm. View stays in place.'.format(len(done), mm)
                            + (u' ' + u'; '.join(d for d in done if u'(' in d) if any(u'(' in d for d in done) else u''))

    def nudge(self, uiapp, sx, sy, big):
        host, markers, right, up = self.prepare(uiapp)
        step = self.step_ft(big)
        delta = right.Multiply(sx * step).Add(up.Multiply(sy * step))
        self.apply(host, markers, delta)

    def pick_move(self, uiapp):
        host, markers, right, up = self.prepare(uiapp)
        p1 = uidoc.Selection.PickPoint(u'Click 1: where the marker is now (circle center). Esc — cancel')
        p2 = uidoc.Selection.PickPoint(u'Click 2: where to move it (Esc — cancel)')
        d = XYZ(p2.X - p1.X, p2.Y - p1.Y, 0.0)
        dx, dy = d.DotProduct(right), d.DotProduct(up)
        if bool(self.rbX.IsChecked):
            dy = 0.0
        elif bool(self.rbY.IsChecked):
            dx = 0.0
        delta = right.Multiply(dx).Add(up.Multiply(dy))
        if delta.GetLength() < 1e-6:
            self.set_status(u'Zero move.')
            return
        self.apply(host, markers, delta)


def open_marker_nudge(uiapp):
    """Opens the marker move panel (the "Tools" tab)."""
    panel = _NUDGE[0]
    if panel is not None:
        try:
            panel.win.Activate()
            return u'The marker move panel is already open.'
        except Exception:
            _NUDGE[0] = None
    _NUDGE[0] = MarkerNudgePanel(uiapp)
    return u'Marker move panel opened: select a marker on the plan and move it with the arrows.'


# ---- VIEW FROM SELECTION: remember elements + side, open a sheet, insert the ready view ----
# Strip height (DIP): matches the bottom toolbar. The panel registers as a Win32 AppBar and sits on top of the taskbar.
VM_BAR_HEIGHT = 40.0

VM_XAML = u'''
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="View from Selection → Sheet" Height="40" ResizeMode="NoResize" WindowStyle="None"
        Topmost="False" ShowInTaskbar="False" ShowActivated="False"
        FontFamily="Segoe UI Variable Text, Segoe UI, Arial" FontSize="12" AllowsTransparency="True" Background="Transparent" Foreground="{DynamicResource PillText}">
  <Window.Resources>
    <Style x:Key="PillB" TargetType="Button">
      <Setter Property="Foreground" Value="{DynamicResource PillText}"/>
      <Setter Property="Background" Value="{DynamicResource PillBg}"/>
      <Setter Property="Margin" Value="2,0"/>
      <Setter Property="Padding" Value="12,0"/>
      <Setter Property="Height" Value="26"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="bd" Background="{TemplateBinding Background}" CornerRadius="13" Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="bd" Property="Opacity" Value="0.85"/></Trigger>
              <Trigger Property="IsPressed" Value="True"><Setter TargetName="bd" Property="Opacity" Value="0.65"/></Trigger>
              <Trigger Property="IsEnabled" Value="False"><Setter TargetName="bd" Property="Opacity" Value="0.4"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="PillR" TargetType="RadioButton">
      <Setter Property="Foreground" Value="{DynamicResource PillText}"/>
      <Setter Property="Margin" Value="2,0"/>
      <Setter Property="Padding" Value="12,0"/>
      <Setter Property="Height" Value="26"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="RadioButton">
            <Border x:Name="bd" Background="{DynamicResource PillBg}" CornerRadius="13" Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="bd" Property="Background" Value="{DynamicResource PillHover}"/></Trigger>
              <Trigger Property="IsChecked" Value="True">
                <Setter TargetName="bd" Property="Background" Value="{DynamicResource SelBg}"/>
                <Setter Property="Foreground" Value="{DynamicResource SelText}"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="PillT" TargetType="ToggleButton">
      <Setter Property="Foreground" Value="{DynamicResource PillText}"/>
      <Setter Property="Margin" Value="2,0"/>
      <Setter Property="Padding" Value="12,0"/>
      <Setter Property="Height" Value="26"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="ToggleButton">
            <Border x:Name="bd" Background="{DynamicResource PillBg}" CornerRadius="13" Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="bd" Property="Background" Value="{DynamicResource PillHover}"/></Trigger>
              <Trigger Property="IsChecked" Value="True">
                <Setter TargetName="bd" Property="Background" Value="{DynamicResource SelBg}"/>
                <Setter Property="Foreground" Value="{DynamicResource SelText}"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style TargetType="TextBox">
      <Setter Property="Foreground" Value="{DynamicResource PillText}"/>
      <Setter Property="CaretBrush" Value="{DynamicResource PillText}"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="TextBox">
            <Border Background="{DynamicResource PillBg}" CornerRadius="13" Height="26">
              <ScrollViewer x:Name="PART_ContentHost" Margin="12,0" VerticalAlignment="Center"/>
            </Border>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
  </Window.Resources>
  <Border x:Name="vmCard" Background="{DynamicResource BarBg}" BorderBrush="{DynamicResource BarBorder}" BorderThickness="0,1,0,0">
    <Grid>
      <Grid.ColumnDefinitions>
        <ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/>
      </Grid.ColumnDefinitions>
      <TextBlock x:Name="tbStatus" Grid.Column="0" Margin="16,0,12,0" VerticalAlignment="Center" FontSize="11"
                 Foreground="{DynamicResource Hint}" TextTrimming="CharacterEllipsis"/>
      <StackPanel x:Name="vmPanel" Grid.Column="1" Orientation="Horizontal" VerticalAlignment="Center">
        <Button x:Name="btnCapture" Style="{StaticResource PillB}" Padding="0" MinWidth="30"
                ToolTip="1. Capture: select elements in Revit (plan or 3D) and capture them">
          <StackPanel Orientation="Horizontal" Margin="9,0">
            <TextBlock Text="&#xE722;" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" FontSize="13" VerticalAlignment="Center"/>
            <TextBlock x:Name="tbSel" Margin="5,0,0,0" Foreground="{DynamicResource NumText}" FontWeight="SemiBold" VerticalAlignment="Center"/>
          </StackPanel>
        </Button>
        <Border Width="8"/>
        <StackPanel x:Name="gridSide" Orientation="Horizontal" ToolTip="2. Side: viewing direction (like the elevation marker arrow on the plan)">
          <RadioButton x:Name="rbUp" GroupName="side" Style="{StaticResource PillR}" Content="↑" Width="26" Padding="0" Margin="1,0"/>
          <RadioButton x:Name="rbLeft" GroupName="side" Style="{StaticResource PillR}" Content="←" Width="26" Padding="0" Margin="1,0"/>
          <RadioButton x:Name="rbRight" GroupName="side" Style="{StaticResource PillR}" Content="→" Width="26" Padding="0" Margin="1,0"/>
          <RadioButton x:Name="rbDown" GroupName="side" Style="{StaticResource PillR}" Content="↓" Width="26" Padding="0" Margin="1,0"/>
        </StackPanel>
        <Border Width="8"/>
        <ToggleButton x:Name="btnKind" Style="{StaticResource PillT}" Padding="11,0,8,0" ToolTip="View type: Elevation / Section / Plan / RCP">
          <StackPanel Orientation="Horizontal">
            <TextBlock x:Name="tbKind" Text="Elevation" VerticalAlignment="Center"/>
            <TextBlock Text="&#xE70E;" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" FontSize="9" Margin="7,1,0,0" VerticalAlignment="Center"/>
          </StackPanel>
        </ToggleButton>
        <Popup x:Name="popKind" StaysOpen="False" AllowsTransparency="True" Placement="Top" PopupAnimation="Fade">
          <Border Margin="8" Padding="4" CornerRadius="14" Background="{DynamicResource BarBg}" BorderBrush="{DynamicResource BarBorder}" BorderThickness="1">
            <Border.Effect><DropShadowEffect BlurRadius="14" ShadowDepth="2" Direction="270" Opacity="0.35" Color="Black"/></Border.Effect>
            <StackPanel>
              <Button x:Name="optElev" Style="{StaticResource PillB}" Content="Elevation" Width="112" Margin="0,2" ToolTip="Elevation: marker on the plan"/>
              <Button x:Name="optSect" Style="{StaticResource PillB}" Content="Section" Width="112" Margin="0,2"/>
              <Button x:Name="optPlan" Style="{StaticResource PillB}" Content="Plan" Width="112" Margin="0,2" ToolTip="Floor Plan cropped to the selection (for horizontal items). No side needed"/>
              <Button x:Name="optRcp" Style="{StaticResource PillB}" Content="RCP" Width="112" Margin="0,2" ToolTip="Reflected Ceiling Plan cropped to the selection. No side needed"/>
            </StackPanel>
          </Border>
        </Popup>
        <StackPanel x:Name="kindStore" Visibility="Collapsed">
          <RadioButton x:Name="rbElev" GroupName="kind" Content="Elevation" IsChecked="True"/>
          <RadioButton x:Name="rbSect" GroupName="kind" Content="Section"/>
          <RadioButton x:Name="rbPlan" GroupName="kind" Content="Plan"/>
          <RadioButton x:Name="rbRcp" GroupName="kind" Content="RCP"/>
        </StackPanel>
        <Border Width="6"/>
        <ToggleButton x:Name="chkIso" Style="{StaticResource PillT}" Content="&#xE7B3;" Width="30" Padding="0" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" FontSize="13" IsChecked="True"
                      ToolTip="Isolate selected: everything else is hidden in the view"/>
        <Grid Width="118" Margin="2,0,0,0">
          <TextBox x:Name="tbName" ToolTip="View label (optional)"/>
          <TextBlock x:Name="tbNamePh" Text="View label" Margin="12,0,0,0" VerticalAlignment="Center" IsHitTestVisible="False" Foreground="{DynamicResource Hint}"/>
        </Grid>
        <Border Width="6"/>
        <Button x:Name="btnInsert" Style="{StaticResource PillB}" Background="{DynamicResource AccBg}" Foreground="{DynamicResource AccText}"
                Content="&#xE7C3;" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" FontSize="13" Width="34" Padding="0"
                ToolTip="3. Place on sheet: open the target sheet and place the view"/>
      </StackPanel>
      <StackPanel Grid.Column="2" Orientation="Horizontal" HorizontalAlignment="Right" VerticalAlignment="Center">
        <StackPanel x:Name="swBar" Orientation="Horizontal" Margin="0,0,8,0">
          <ToggleButton x:Name="swVm" Style="{StaticResource PillT}" Content="&#xE7C4;" Width="28" Padding="0"
                        FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" FontSize="13"
                        ToolTip="View Creation (this bar)"/>
          <ToggleButton x:Name="swAnn" Style="{StaticResource PillT}" Content="&#xE8EC;" Width="28" Padding="0"
                        FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" FontSize="13"
                        ToolTip="Annotations: show the Annotations bar next to this one"/>
        </StackPanel>
        <Button x:Name="btnClose" Style="{StaticResource PillB}" Background="Transparent" Foreground="{DynamicResource Hint}"
                Content="✕" Width="28" Padding="0" Margin="0,0,10,0" ToolTip="Close"/>
      </StackPanel>
    </Grid>
  </Border>
</Window>
'''

_VM = [None]


def _sheet_plan_of_view(view):
    """The plan located on the same sheet as `view` (key plan next to the 3D)."""
    try:
        for port in FilteredElementCollector(doc).OfClass(Viewport):
            if port.ViewId == view.Id:
                sheet = doc.GetElement(port.SheetId)
                for ident in sheet.GetAllViewports():
                    other = doc.GetElement(doc.GetElement(ident).ViewId)
                    if isinstance(other, DB.ViewPlan) and not other.IsTemplate and other.GenLevel is not None \
                            and other.ViewType == ViewType.FloorPlan:
                        return other
    except Exception:
        pass
    return None


def _host_plan_for(elements, active):
    """Plan for Elevation markers: the active plan, otherwise the plan on the same sheet, otherwise the nearest by level."""
    if isinstance(active, DB.ViewPlan) and not active.IsTemplate and active.GenLevel is not None \
            and active.ViewType == ViewType.FloorPlan:
        return active
    found = _sheet_plan_of_view(active)
    if found is not None:
        return found
    low, high = bounds(elements)
    best, gap = None, None
    for v in FilteredElementCollector(doc).OfClass(DB.ViewPlan):
        if v.IsTemplate or v.GenLevel is None or v.ViewType != ViewType.FloorPlan:
            continue
        g = abs(v.GenLevel.Elevation - low.Z)
        if gap is None or g < gap:
            best, gap = v, g
    return best


def _set_ceiling_range(view, level, low, high):
    """RCP only sees what is ABOVE the Cut plane: we put Cut slightly below the selection, Top above it.
    The order of steps matters: Revit requires Top >= Cut >= Bottom >= View Depth at every step."""
    P = DB.PlanViewPlane
    base, margin, big = level.Elevation, 50.0 / 304.8, 500.0
    cut = low.Z - base - margin
    top = max(high.Z - base + margin, cut + margin)
    bottom = cut - 1.0
    vr = view.GetViewRange()
    try:
        def put(plane, off):
            vr.SetLevelId(plane, level.Id)
            vr.SetOffset(plane, off)
        put(P.TopClipPlane, big)
        put(P.ViewDepthPlane, -big)
        put(P.BottomClipPlane, -big)
        put(P.CutPlane, cut)
        put(P.BottomClipPlane, bottom)
        put(P.ViewDepthPlane, bottom)
        put(P.TopClipPlane, top)
        view.SetViewRange(vr)
    finally:
        vr.Dispose()


def _crop_plan_to(view, elements, margin_ft):
    low, high = bounds(elements)
    box = view.CropBox
    inv = box.Transform.Inverse
    pts = [inv.OfPoint(XYZ(x, y, z)) for x in (low.X, high.X) for y in (low.Y, high.Y) for z in (low.Z, high.Z)]
    new_box = DB.BoundingBoxXYZ()
    new_box.Transform = box.Transform
    new_box.Min = XYZ(min(p.X for p in pts) - margin_ft, min(p.Y for p in pts) - margin_ft, box.Min.Z)
    new_box.Max = XYZ(max(p.X for p in pts) + margin_ft, max(p.Y for p in pts) + margin_ft, box.Max.Z)
    view.CropBoxActive = True
    view.CropBox = new_box
    view.CropBoxVisible = False


def _elements_level(elements, host):
    """The level the selected elements stand on (as in Properties -> Level); otherwise the host plan's level; otherwise None.
    Levels of different zones (LEVEL 34 MOB, LEVEL 39_YZH...) have close elevations, so searching by Z is not possible."""
    counts, ids = {}, {}
    for el in elements:
        lid = None
        try:
            lid = el.LevelId
        except Exception:
            lid = None
        if lid is None or lid == ElementId.InvalidElementId:
            for bip in (BuiltInParameter.FAMILY_LEVEL_PARAM, BuiltInParameter.SCHEDULE_LEVEL_PARAM,
                        BuiltInParameter.INSTANCE_REFERENCE_LEVEL_PARAM):
                try:
                    p = el.get_Parameter(bip)
                    if p is not None and p.HasValue and p.AsElementId() != ElementId.InvalidElementId:
                        lid = p.AsElementId()
                        break
                except Exception:
                    continue
        if lid is None or lid == ElementId.InvalidElementId:
            continue
        key = id_value(lid)
        counts[key] = counts.get(key, 0) + 1
        ids[key] = lid
    for key in sorted(counts, key=lambda k: -counts[k]):
        level = doc.GetElement(ids[key])
        if isinstance(level, DB.Level):
            return level
    try:
        if host is not None and host.GenLevel is not None:
            return host.GenLevel
    except Exception:
        pass
    return None


BROWSER_PARAMS = []   # filled from settings (the "Tools" tab)


def _copy_browser_params(view, donors):
    """Project Browser grouping parameters (the list in the "Tools" tab) are taken from the neighboring view on the sheet,
    and if there is none - from the sheet itself. This way the new view lands in the same folder, not in the duplicated plan's folder."""
    for name in BROWSER_PARAMS:
        value = None
        for donor in donors:
            if donor is None:
                continue
            try:
                p = donor.LookupParameter(name)
                if p is not None and p.HasValue and p.StorageType == DB.StorageType.String and p.AsString():
                    value = p.AsString()
                    break
            except Exception:
                continue
        try:
            dest = view.LookupParameter(name)
            if dest is not None and not dest.IsReadOnly and dest.StorageType == DB.StorageType.String:
                dest.Set(value or u'')
        except Exception:
            pass


def plan_view_from_selection(elements, kind, style_view, name, label, isolate, warnings, host=None, sheet=None):
    """Floor Plan (kind='plan') or Reflected Ceiling Plan (kind='rcp') only for `elements` - for horizontal
    items (countertops, slabs, ceilings). Level - the nearest not above the bottom of the selection. Crop - bounding box with margin."""
    low, high = bounds(elements)
    family = DB.ViewFamily.CeilingPlan if kind == 'rcp' else DB.ViewFamily.FloorPlan
    types = [t for t in FilteredElementCollector(doc).OfClass(DB.ViewFamilyType) if t.ViewFamily == family]
    if not types:
        fail(u'The project has no {} view type.'.format(u'Reflected Ceiling Plan' if kind == 'rcp' else u'Floor Plan'))
    level = _elements_level(elements, host)
    if level is None:
        levels = sorted(FilteredElementCollector(doc).OfClass(DB.Level), key=lambda l: l.Elevation)
        if not levels:
            fail(u'The project has no levels.')
        level = levels[0]
        for lv in levels:
            if lv.Elevation <= low.Z + 0.05:
                level = lv
        warnings.append(u'Element level not found, used the nearest level by elevation: ' + title(level))
    view = None
    try:
        view = DB.ViewPlan.Create(doc, types[0].Id, level.Id)
    except Exception as exc:
        # Revit does not allow a second plan of this type on the level: duplicating the existing one
        for other in FilteredElementCollector(doc).OfClass(DB.ViewPlan):
            try:
                if (not other.IsTemplate and other.GenLevel is not None and other.GenLevel.Id == level.Id
                        and doc.GetElement(other.GetTypeId()).ViewFamily == family):
                    view = doc.GetElement(other.Duplicate(DB.ViewDuplicateOption.Duplicate))
                    break
            except Exception:
                continue
        if view is None:
            fail(u'Could not create {}: {}'.format(u'RCP' if kind == 'rcp' else u'plan', err_text(exc).split(u'\n')[0]))
    if style_view is not None:
        configure_view_soft(style_view, view)
    else:
        try:
            view.ViewTemplateId = ElementId.InvalidElementId
        except Exception:
            pass
    view.Name = name
    if label:
        dest = view.get_Parameter(BuiltInParameter.VIEW_DESCRIPTION)
        if dest and not dest.IsReadOnly:
            dest.Set(label)
    _copy_browser_params(view, [style_view, sheet])
    doc.Regenerate()
    if kind == 'rcp':
        try:
            _set_ceiling_range(view, level, low, high)
        except Exception as exc:
            warnings.append(u'RCP View Range was not set: ' + err_text(exc).split(u'\n')[0])
    try:
        _crop_plan_to(view, elements, 150.0 / 304.8)
    except Exception as exc:
        warnings.append(u'View crop was not applied: ' + err_text(exc).split(u'\n')[0])
    if isolate:
        try:
            isolate_elements(view, elements)
        except Exception as exc:
            warnings.append(u'Isolating the selection failed: ' + err_text(exc).split(u'\n')[0])
    return view


def view_from_selection(elements, look, kind, host, style_view, name, label, isolate, warnings, sheet=None):
    """Section or Elevation on the `look` side (view direction on the plan) only for `elements`. The crop encloses the selection
    with margins, the section plane stands in front of it. kind='plan' / 'rcp' - a horizontal view without a side.
    Works inside the caller's open transaction."""
    if kind in ('plan', 'rcp'):
        return plan_view_from_selection(elements, kind, style_view, name, label, isolate, warnings, host, sheet)
    low, high = bounds(elements)
    mid = low.Add(high).Multiply(0.5)
    toward = look.Negate()                     # ViewDirection points at the viewer
    side = {'n': (toward.X, toward.Y), 'c': (mid.X * _MM, mid.Y * _MM), 'letter': name, 'marker': None}
    type_id, elev_hint = None, None
    if style_view is not None:
        family = doc.GetElement(style_view.GetTypeId())
        if getattr(family, 'ViewFamily', None) == DB.ViewFamily.Section:
            type_id = family.Id
        elif getattr(family, 'ViewFamily', None) == DB.ViewFamily.Elevation:
            elev_hint = family.Id
    if type_id is None:
        found = [t for t in FilteredElementCollector(doc).OfClass(DB.ViewFamilyType) if t.ViewFamily == DB.ViewFamily.Section]
        if not found:
            fail(u'The project has no Section view type.')
        type_id = found[0].Id
    view = None
    for attempt in (0, 1):
        conv = CLEAN_CONV['v'] if attempt == 0 else -CLEAN_CONV['v']
        view = DB.ViewSection.CreateSection(doc, type_id, _clean_box(side, elements, conv, None))
        doc.Regenerate()
        vd = view.ViewDirection
        if vd.X * toward.X + vd.Y * toward.Y > 0:
            CLEAN_CONV['v'] = conv
            break
        doc.Delete(view.Id)
        view = None
    if view is None:
        fail(u'Could not turn the view to the chosen side.')
    if kind == 'elevation':
        ELEV['host'] = host
        ELEV['errors'] = []
        upgraded = upgrade_to_elevation(view, elev_hint, None) if host is not None else None
        if upgraded is not None:
            view = upgraded
        else:
            warnings.append(u'Could not create Elevation, kept Section' + (
                u': ' + ELEV['errors'][0] if ELEV.get('errors') else u' (no host plan for the marker)'))
    if style_view is not None:
        configure_view_soft(style_view, view)
    view.Name = name
    if label:
        dest = view.get_Parameter(BuiltInParameter.VIEW_DESCRIPTION)
        if dest and not dest.IsReadOnly:
            dest.Set(label)
    try:
        view.CropBoxActive, view.CropBoxVisible = True, False
    except Exception:
        pass
    if isolate:
        try:
            isolate_elements(view, elements)
        except Exception as exc:
            warnings.append(u'Isolating the selection failed: ' + err_text(exc).split(u'\n')[0])
    return view


class ViewMakerPanel(object):
    """Modeless panel: 1) remember the selection, 2) side, 3) on an open sheet "Insert"."""

    def __init__(self, uiapp):
        self.win = load_xaml(VM_XAML)
        for n in u'btnCapture btnInsert tbSel tbStatus tbName chkIso rbUp rbDown rbLeft rbRight rbElev rbSect rbPlan rbRcp gridSide btnClose swBar swVm swAnn vmCard vmPanel btnKind tbKind popKind optElev optSect optPlan optRcp tbNamePh'.split():
            setattr(self, n, self.win.FindName(n))
        self.theme, self.tick, self.susp, self.abar_hwnd, self.revit_hwnd = None, 0, False, None, 0
        self.hidden = False   # the strip is hidden by the toggle (the window lives, reserved space released)
        self.merged = False   # the panel is embedded in the Annotations strip (one merged strip)
        self.vmGrid = self.vmPanel.Parent
        self.apply_theme()
        self.handler = Handler()
        self.handler.on_error = self.set_status
        self.ev = ExternalEvent.Create(self.handler)
        self.ids = []
        self.host_id = None
        self.right, self.up = XYZ.BasisX, XYZ.BasisY
        self.btnCapture.Click += lambda s, e: self.queue(self.capture)
        self.btnInsert.Click += lambda s, e: self.queue(self.insert)
        for rb in (self.rbElev, self.rbSect, self.rbPlan, self.rbRcp):
            rb.Checked += self.on_kind
        # view type - a dropdown list (RadioButtons remain a hidden selection store)
        self.popKind.PlacementTarget = self.btnKind
        self._kind_closed_at = 0.0
        self.btnKind.Click += self.on_kind_click
        self.popKind.Closed += self.on_kind_closed
        for rb, opt in ((self.rbElev, self.optElev), (self.rbSect, self.optSect),
                        (self.rbPlan, self.optPlan), (self.rbRcp, self.optRcp)):
            opt.Click += lambda s, e, r=rb: self.pick_kind(r)
        self.tbName.TextChanged += lambda s, e: setattr(
            self.tbNamePh, 'Visibility', Visibility.Collapsed if self.tbName.Text else Visibility.Visible)
        self.btnClose.Click += lambda s, e: self.win.Close()
        self.swVm.Click += lambda s, e: bar_toggle(u'vm')
        self.swAnn.Click += lambda s, e: bar_toggle(u'ann')
        self.win.Closing += lambda s, e: self.on_closing()
        self.timer = DispatcherTimer()
        self.timer.Interval = TimeSpan.FromMilliseconds(400)
        self.timer.Tick += lambda s, e: self.watch()
        self.timer.Start()
        self.win.Closed += self.on_closed
        self.dock(uiapp)

    def dock(self, uiapp):
        """AppBar at the bottom of the screen (on top of the taskbar): Windows shrinks the work area,
        so maximized Revit is not covered. Falls back to a plain window if the AppBar fails."""
        w = self.win
        self.abar_hwnd = None
        try:
            self.revit_hwnd = uiapp.MainWindowHandle.ToInt64()
        except Exception:
            self.revit_hwnd = 0
        w.WindowStartupLocation = WindowStartupLocation.Manual
        try:
            WindowInteropHelper(w).Owner = uiapp.MainWindowHandle
        except Exception:
            pass
        try:
            WindowInteropHelper(w).EnsureHandle()
            from System.Windows import SystemParameters
            wa = SystemParameters.WorkArea
            self.place(wa.Left, wa.Bottom - VM_BAR_HEIGHT, wa.Width, VM_BAR_HEIGHT)
        except Exception:
            pass
        w.Show()
        self.abar_apply()
        try:
            bar_sync()
        except Exception as ex:
            tk_log(u'view maker switch: {}'.format(ex))

    def apply_theme(self):
        """Colors follow the Windows app theme (same palette as the annotation bar)."""
        t = u'dark' if ann_sys_dark() else u'light'
        if t == self.theme:
            return
        self.theme = t
        pal = ANN_BAR_PAL[t]
        try:
            if self.merged and _TK_MAIN[0] is not None:
                _TK_MAIN[0].ann_bar_apply_theme()      # the Annotations strip is in the same window: redraw together
        except Exception as ex:
            tk_log(u'view maker theme ann: {}'.format(ex))
        res = self.win.Resources
        for key, val in ((u'BarBg', u'#' + pal['card_d'][-6:]), (u'BarBorder', pal['border_d']),
                         (u'PillBg', pal['pill']), (u'PillHover', pal['pill_h']), (u'PillText', pal['pill_t']),
                         (u'SelBg', pal['seg_sel_bg']), (u'SelText', pal['seg_sel_t']), (u'Hint', pal['hint']),
                         (u'AccBg', pal['acc']), (u'AccText', pal['acc_t']), (u'NumText', pal['num'])):
            res[key] = ann_brush(val)
        self.sync_panel_res()

    def sync_panel_res(self):
        """The panel has its own resources (styles + theme brushes) to look the same in the View Creation window,
        and when embedded in the Annotations strip."""
        try:
            pr = self.vmPanel.Resources
            for key in list(self.win.Resources.Keys):
                pr[key] = self.win.Resources[key]
        except Exception as ex:
            tk_log(u'view maker panel resources: {}'.format(ex))

    def watch(self):
        """Every 2 s: re-check the Windows theme. Revit minimized: release the reserved space; restored: reserve again."""
        self.tick += 1
        if self.tick % 5 == 0:
            try:
                self.apply_theme()
            except Exception as ex:
                tk_log(u'view maker theme: {}'.format(ex))
        if self.hidden:
            return
        try:
            import ctypes
            iconic = bool(ctypes.windll.user32.IsIconic(ctypes.c_void_p(self.revit_hwnd)))
        except Exception:
            return
        if iconic:
            if self.abar_hwnd:
                self.abar_remove()
                self.susp = True
        elif self.susp:
            self.susp = False
            self.abar_apply()
        elif self.abar_hwnd:
            abar_check()

    def on_closing(self):
        try:
            self.timer.Stop()
        except Exception:
            pass
        self.abar_remove()

    def place(self, left, top, width, height):
        w = self.win
        old = None
        try:
            if w.IsVisible and w.Opacity > 0.5:
                old = float(w.Top)
        except Exception:
            old = None
        w.Width = float(width)
        w.Height = float(height)
        w.Left = float(left)
        w.Top = float(top)
        if old is not None:
            slide_top(w, old, float(top))

    def abar_apply(self):
        if abar_set(u'vm', 1, self.win, lambda width: VM_BAR_HEIGHT, self.place, self.set_top):
            self.abar_hwnd = True

    def set_top(self, top):
        """The top strip of the stack - with rounded top corners."""
        if top:
            self.vmCard.CornerRadius = CornerRadius(20, 20, 0, 0)
            self.vmCard.BorderThickness = Thickness(1, 1, 1, 0)
        else:
            self.vmCard.CornerRadius = CornerRadius(0)
            self.vmCard.BorderThickness = Thickness(0, 1, 0, 0)

    def abar_remove(self):
        abar_drop(u'vm')
        self.abar_hwnd = None

    def set_status(self, text):
        try:
            if self.merged and _TK_MAIN[0] is not None:
                _TK_MAIN[0].ann_bar_hint((text or u'').replace(u'\n', u'  '))
            self.tbStatus.Text = (text or u'').replace(u'\n', u'  ')
            self.tbStatus.ToolTip = text
        except Exception:
            pass

    # ---- merged strip: the View Creation panel lives in the left part of the Annotations strip ----
    def merge_into(self, main):
        b = _bar_ann_dict()
        host = b.get('vmHost')
        if host is None:
            host = Border()
            host.Margin = Thickness(12, 0, 0, 0)
            host.VerticalAlignment = VerticalAlignment.Center
            b['grp'].Children.Add(host)
            b['vmHost'] = host
        _detach_el(self.vmPanel)
        host.Child = self.vmPanel
        host.Visibility = Visibility.Visible
        self.merged = True
        self.abar_remove()
        try:
            self.win.Hide()
        except Exception:
            pass
        main.ann_bar_abar_apply()

    def unmerge(self, refresh_ann=True):
        if not self.merged:
            return
        self.merged = False
        b = _bar_ann_dict()
        _detach_el(self.vmPanel)
        try:
            self.vmGrid.Children.Add(self.vmPanel)
        except Exception as ex:
            tk_log(u'view maker unmerge: {}'.format(ex))
        if b.get('vmHost') is not None:
            b['vmHost'].Visibility = Visibility.Collapsed
        if not self.hidden:
            try:
                self.win.Show()
            except Exception:
                pass
            self.abar_apply()
            fade_win(self.win, 1.0, 190, None, 0.0)
        if refresh_ann and _TK_MAIN[0] is not None and b.get('win') is not None and not b.get('hidden'):
            try:
                _TK_MAIN[0].ann_bar_abar_apply()
            except Exception as ex:
                tk_log(u'view maker unmerge ann: {}'.format(ex))

    def on_kind_click(self, s, e):
        if time.time() - self._kind_closed_at < 0.25:     # a click on the button closed the open list - do not open it again
            self.btnKind.IsChecked = False
            return
        self.popKind.IsOpen = True
        self.btnKind.IsChecked = True

    def on_kind_closed(self, s, e):
        self._kind_closed_at = time.time()
        self.btnKind.IsChecked = False

    def pick_kind(self, rb):
        rb.IsChecked = True
        self.popKind.IsOpen = False

    def bar_hide(self):
        """Hide the strip without closing it: the state (captured selection, side, name) stays."""
        if self.hidden:
            return
        self.hidden = True
        self.susp = False

        def fin():
            if not self.hidden:      # while it was fading, the strip was already shown again
                return
            self.abar_remove()
            try:
                self.win.Hide()
            except Exception:
                pass
        fade_win(self.win, 0.0, 150, fin)

    def bar_show(self):
        if not self.hidden:
            return
        self.hidden = False
        try:
            if bars_merge_ok(self):            # there is enough room and Annotations is visible - straight into one strip
                self.merge_into(_TK_MAIN[0])
                return
        except Exception as ex:
            tk_log(u'view maker bar_show merge: {}'.format(ex))
        try:
            self.win.Show()
        except Exception:
            pass
        self.abar_apply()
        fade_win(self.win, 1.0, 190, None, 0.0)

    def sw_paint(self, state):
        """Two toggle icons. We show them only when this strip is the only one: when both are visible, the toggle lives
        only in Annotations (the lower strip) so that it is not duplicated."""
        try:
            self.swVm.IsChecked = state in (u'vm', u'both')
            self.swAnn.IsChecked = state in (u'ann', u'both')
            self.swBar.Visibility = Visibility.Visible if state in (u'vm', None) else Visibility.Collapsed
        except Exception:
            pass

    def on_closed(self, s, e):
        try:
            self.unmerge(False)
        except Exception:
            pass
        _VM[0] = None
        try:
            bar_after_close(u'vm')
        except Exception as ex:
            tk_log(u'view maker closed: {}'.format(ex))

    def on_kind(self, s, e):
        """Plan / RCP have no side: the arrows are disabled."""
        horizontal = bool(self.rbPlan.IsChecked) or bool(self.rbRcp.IsChecked)
        for rb, nm in ((self.rbElev, u'Elevation'), (self.rbSect, u'Section'), (self.rbPlan, u'Plan'), (self.rbRcp, u'RCP')):
            if bool(rb.IsChecked):
                self.tbKind.Text = nm
        self.gridSide.IsEnabled = not horizontal
        self.gridSide.Opacity = 0.3 if horizontal else 1.0

    def queue(self, work):
        self.handler.queue.append((u'viewmaker', lambda uiapp: self.safe(uiapp, work)))
        req = self.ev.Raise()
        if req != ExternalEventRequest.Accepted and req != ExternalEventRequest.Pending:
            self.handler.queue = []
            self.set_status(u'Revit is busy (a command is active). Try again.')

    def safe(self, uiapp, work):
        try:
            work(uiapp)
        except OperationCanceledException:
            self.set_status(u'Cancelled.')
        except Exception as exc:
            print(traceback.format_exc())
            self.set_status(u'✗ ' + err_text(exc))

    def prepare(self, uiapp):
        global uidoc, doc
        uidoc = uiapp.ActiveUIDocument
        doc = uidoc.Document if uidoc else None
        if doc is None or doc.IsFamilyDocument:
            fail(u'Open an RVT project.')

    def capture(self, uiapp):
        self.prepare(uiapp)
        elements = []
        for ident in uidoc.Selection.GetElementIds():
            el = doc.GetElement(ident)
            if el is None or isinstance(el, (DB.View, DB.ElevationMarker, DB.Viewport)):
                continue
            cat = el.Category
            if cat is None or cat.CategoryType != DB.CategoryType.Model or el.get_BoundingBox(None) is None:
                continue
            elements.append(el)
        if not elements:
            fail(u'First select model elements in Revit (not views or annotations).')
        host = _host_plan_for(elements, uidoc.ActiveView)
        self.ids = [e.Id for e in elements]
        self.host_id = host.Id if host is not None else None
        r = _flat_dir(host.RightDirection) if host is not None else None
        u = _flat_dir(host.UpDirection) if host is not None else None
        self.right, self.up = (r or XYZ.BasisX), (u or XYZ.BasisY)
        self.tbSel.Text = u'\u00d7{}'.format(len(elements))
        self.tbSel.ToolTip = (u'Host plan for the marker: ' + title(host)) if host is not None \
            else u'No host plan found for the marker: Section will be used.'
        self.set_status(u'✓ Captured {}. {} Choose a side, open a sheet and press “Place on sheet”.'.format(
            len(elements), (u'Plan: ' + title(host) + u'.') if host is not None else u'No host plan for the marker: Section will be used.'))

    def chosen_side(self):
        for rb, sx, sy in ((self.rbUp, 0, 1), (self.rbDown, 0, -1), (self.rbLeft, -1, 0), (self.rbRight, 1, 0)):
            if bool(rb.IsChecked):
                return sx, sy
        fail(u'Choose a side (arrow): the viewing direction.')

    def insert(self, uiapp):
        self.prepare(uiapp)
        if not self.ids:
            fail(u'First capture the selected elements.')
        sheet = uidoc.ActiveView
        if not isinstance(sheet, DB.ViewSheet):
            fail(u'Open a sheet (the sheet itself, no activated view) and press again.')
        elements = [doc.GetElement(i) for i in self.ids]
        if any(e is None for e in elements):
            fail(u'The captured elements no longer exist in the model. Select them again.')
        if bool(self.rbPlan.IsChecked):
            kind = 'plan'
        elif bool(self.rbRcp.IsChecked):
            kind = 'rcp'
        else:
            kind = 'elevation' if bool(self.rbElev.IsChecked) else 'section'
        if kind in ('plan', 'rcp'):
            sx, sy, look = 0, 0, None
        else:
            sx, sy = self.chosen_side()
            look = self.right.Multiply(sx).Add(self.up.Multiply(sy))
        host = doc.GetElement(self.host_id) if self.host_id is not None else None
        style_view, style_type = None, None
        for port, v in sheet_view_slots(sheet):
            if is_section_like(v):
                style_view, style_type = v, port.GetTypeId()
                break
        text = (self.tbName.Text or u'').strip()
        used = [v.Name for v in FilteredElementCollector(doc).OfClass(DB.View)]
        if kind == 'plan':
            default = u'{} - plan'.format(sheet.SheetNumber)
        elif kind == 'rcp':
            default = u'{} - RCP'.format(sheet.SheetNumber)
        else:
            arrow = {(0, 1): u'↑', (0, -1): u'↓', (-1, 0): u'←', (1, 0): u'→'}[(sx, sy)]
            default = u'{} - view {}'.format(sheet.SheetNumber, arrow)
        name = free_name(text or default, used)
        outline = sheet.Outline
        centre = XYZ((outline.Min.U + outline.Max.U) / 2.0, (outline.Min.V + outline.Max.V) / 2.0, 0.0)
        warnings = []
        group = TransactionGroup(doc, u'Universal Toolkit: view from selection')
        transaction = Transaction(doc, u'View from selection on sheet')
        group.Start()
        try:
            transaction.Start()
            view = view_from_selection(elements, look, kind, host, style_view, name, text,
                                       bool(self.chkIso.IsChecked), warnings, sheet)
            port = _add_port(sheet, view, style_type, centre)
            if transaction.Commit() != TransactionStatus.Committed:
                fail(u'Revit rolled the transaction back.')
            group.Assimilate()
        except Exception:
            if transaction.GetStatus() == TransactionStatus.Started:
                transaction.RollBack()
            if group.GetStatus() == TransactionStatus.Started:
                group.RollBack()
            raise
        finally:
            transaction.Dispose()
            group.Dispose()
        try:
            uidoc.Selection.SetElementIds(List[ElementId]([port.Id]))
        except Exception:
            pass
        self.set_status(u'✓ {} “{}” placed on sheet {}: centred, move it where needed.'.format(
            {ViewType.Elevation: u'Elevation', ViewType.FloorPlan: u'Plan', ViewType.CeilingPlan: u'RCP'}.get(
                view.ViewType, u'Section'), view.Name, sheet.SheetNumber)
            + (u'\n⚠ ' + u'; '.join(warnings) if warnings else u''))


def open_view_maker(uiapp):
    """Opens the "View from selection → sheet" panel (the "Tools" tab)."""
    panel = _VM[0]
    if panel is not None:
        try:
            if panel.hidden:
                panel.bar_show()
                bar_sync()
            panel.win.Activate()
            return u'The “View from Selection” panel is already open.'
        except Exception:
            _VM[0] = None
    _VM[0] = ViewMakerPanel(uiapp)
    return u'Panel open: select elements, capture, choose a side, open a sheet and place.'


# ======================================================================
#  Shared Apple interface elements (used by both tabs)
# ======================================================================
from System.Windows.Media import FontFamily

ICON_FONT = FontFamily(u"Segoe Fluent Icons, Segoe MDL2 Assets")
BLUE_SOFT = BrushConverter().ConvertFromString("#0F2A4D")


def load_xaml(src, dark=False, isl=False):
    """XAML -> object. The shared Apple theme is substituted at the @THEME@ / @COMMON@ markers.
    isl=True - the island window: the theme (light/dark) is taken from TK_ISL, styles become DynamicResource
    (so the theme can be switched live). If the theme fails to parse, the window still opens."""
    last = None
    first = (THEME_ITEMS, THEME_COMMON_DARK) if dark else (THEME_ITEMS, THEME_COMMON)
    if isl:
        src = tk_isl_prepare(src)
        first = (THEME_ITEMS, tk_isl_dyn(THEME_COMMON_DARK))      # one (dark) base + dynamic brushes for both themes
    for full, common in (first, (u"", u"")):
        try:
            text = src.replace(u"@THEME@", full).replace(u"@COMMON@", common)
            return XamlReader.Load(XmlReader.Create(StringReader(text)))
        except Exception as ex:
            last = ex
    raise last


BLUE = BrushConverter().ConvertFromString("#007AFF")
GRAY = BrushConverter().ConvertFromString("#8E8E93")
HEAD_BG = BrushConverter().ConvertFromString("#1C1C1E")
INDENT = 16

XAML = u"""
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Universal Toolkit" Width="1056" Height="708"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        ResizeMode="NoResize" Topmost="True" ShowInTaskbar="False"
        WindowStartupLocation="Manual" Left="300" Top="0"
        Foreground="#F5F5F7" UseLayoutRounding="True" SnapsToDevicePixels="True"
        FontFamily="Segoe UI Variable Text, Segoe UI, Arial" FontSize="13">
  <Window.Resources>
    <Style x:Key="Btn" TargetType="Button">
      <Setter Property="Foreground" Value="#F5F5F7"/>
      <Setter Property="Background" Value="#1C1C1E"/>
      <Setter Property="Height" Value="34"/>
      <Setter Property="Padding" Value="14,0"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="BorderThickness" Value="0"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="b" Background="{TemplateBinding Background}" CornerRadius="17"
                    Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="b" Property="Background" Value="#2C2C2E"/></Trigger>
              <Trigger Property="IsPressed" Value="True"><Setter TargetName="b" Property="Background" Value="#3A3A3C"/></Trigger>
              <Trigger Property="IsEnabled" Value="False"><Setter TargetName="b" Property="Opacity" Value="0.4"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="BtnPrimary" TargetType="Button" BasedOn="{StaticResource Btn}">
      <Setter Property="Background" Value="#0071E3"/>
      <Setter Property="Foreground" Value="#FFFFFF"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="b" Background="{TemplateBinding Background}" CornerRadius="17"
                    Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="b" Property="Background" Value="#2997FF"/></Trigger>
              <Trigger Property="IsPressed" Value="True"><Setter TargetName="b" Property="Background" Value="#005BB5"/></Trigger>
              <Trigger Property="IsEnabled" Value="False"><Setter TargetName="b" Property="Opacity" Value="0.4"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="BtnLink" TargetType="Button" BasedOn="{StaticResource Btn}">
      <Setter Property="Background" Value="Transparent"/>
      <Setter Property="Foreground" Value="#D1D1D6"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="b" Background="{TemplateBinding Background}" CornerRadius="17"
                    Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="b" Property="Background" Value="#14FFFFFF"/></Trigger>
              <Trigger Property="IsPressed" Value="True"><Setter TargetName="b" Property="Background" Value="#26FFFFFF"/></Trigger>
              <Trigger Property="IsEnabled" Value="False"><Setter TargetName="b" Property="Opacity" Value="0.4"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="IconBtn" TargetType="Button">
      <Setter Property="Foreground" Value="#F5F5F7"/>
      <Setter Property="Background" Value="#1C1C1E"/>
      <Setter Property="FontFamily" Value="Segoe Fluent Icons, Segoe MDL2 Assets"/>
      <Setter Property="FontSize" Value="14"/>
      <Setter Property="Width" Value="34"/>
      <Setter Property="Height" Value="34"/>
      <Setter Property="Margin" Value="0,0,6,0"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="BorderThickness" Value="0"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="b" Background="{TemplateBinding Background}" CornerRadius="17"
                    Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="b" Property="Background" Value="#2C2C2E"/></Trigger>
              <Trigger Property="IsPressed" Value="True"><Setter TargetName="b" Property="Background" Value="#3A3A3C"/></Trigger>
              <Trigger Property="IsEnabled" Value="False"><Setter TargetName="b" Property="Opacity" Value="0.4"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="IconBtnDanger" TargetType="Button" BasedOn="{StaticResource IconBtn}">
      <Setter Property="Foreground" Value="#FF453A"/>
    </Style>
    <Style x:Key="IconBtnPrimary" TargetType="Button" BasedOn="{StaticResource IconBtn}">
      <Setter Property="Background" Value="#0071E3"/>
      <Setter Property="Foreground" Value="#FFFFFF"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="b" Background="{TemplateBinding Background}" CornerRadius="17"
                    Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="b" Property="Background" Value="#2997FF"/></Trigger>
              <Trigger Property="IsPressed" Value="True"><Setter TargetName="b" Property="Background" Value="#005BB5"/></Trigger>
              <Trigger Property="IsEnabled" Value="False"><Setter TargetName="b" Property="Opacity" Value="0.4"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="BtnSm" TargetType="Button" BasedOn="{StaticResource Btn}">
      <Setter Property="Height" Value="24"/>
      <Setter Property="Padding" Value="10,0"/>
      <Setter Property="FontSize" Value="12"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="b" Background="{TemplateBinding Background}" CornerRadius="12"
                    Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="b" Property="Background" Value="#2C2C2E"/></Trigger>
              <Trigger Property="IsPressed" Value="True"><Setter TargetName="b" Property="Background" Value="#3A3A3C"/></Trigger>
              <Trigger Property="IsEnabled" Value="False"><Setter TargetName="b" Property="Opacity" Value="0.4"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="SegBtn" TargetType="Button">
      <Setter Property="Foreground" Value="#F5F5F7"/>
      <Setter Property="Background" Value="Transparent"/>
      <Setter Property="Height" Value="34"/>
      <Setter Property="Padding" Value="14,0"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="BorderThickness" Value="0"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="b" Background="{TemplateBinding Background}" CornerRadius="17"
                    Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="b" Property="Background" Value="#14FFFFFF"/></Trigger>
              <Trigger Property="IsPressed" Value="True"><Setter TargetName="b" Property="Background" Value="#26FFFFFF"/></Trigger>
              <Trigger Property="IsEnabled" Value="False"><Setter TargetName="b" Property="Opacity" Value="0.4"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="SegIcon" TargetType="TextBlock">
      <Setter Property="FontFamily" Value="Segoe Fluent Icons, Segoe MDL2 Assets"/>
      <Setter Property="FontSize" Value="13"/>
      <Setter Property="Margin" Value="0,0,8,0"/>
      <Setter Property="VerticalAlignment" Value="Center"/>
    </Style>
    <Style x:Key="OnLimeBtnL" TargetType="Button">
      <Setter Property="Foreground" Value="#FFFFFF"/>
      <Setter Property="Height" Value="34"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="b" Background="Transparent" CornerRadius="17,0,0,17">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="b" Property="Background" Value="#1FFFFFFF"/></Trigger>
              <Trigger Property="IsPressed" Value="True"><Setter TargetName="b" Property="Background" Value="#33FFFFFF"/></Trigger>
              <Trigger Property="IsEnabled" Value="False"><Setter TargetName="b" Property="Opacity" Value="0.45"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="OnLimeBtnR" TargetType="Button">
      <Setter Property="Foreground" Value="#FFFFFF"/>
      <Setter Property="Height" Value="34"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="b" Background="Transparent" CornerRadius="0,17,17,0">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="b" Property="Background" Value="#1FFFFFFF"/></Trigger>
              <Trigger Property="IsPressed" Value="True"><Setter TargetName="b" Property="Background" Value="#33FFFFFF"/></Trigger>
              <Trigger Property="IsEnabled" Value="False"><Setter TargetName="b" Property="Opacity" Value="0.45"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="Switch" TargetType="CheckBox">
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="CheckBox">
            <Border x:Name="tr" Width="40" Height="24" CornerRadius="12" Background="#3A3A3C">
              <Ellipse x:Name="th" Width="20" Height="20" Fill="White" HorizontalAlignment="Left" Margin="2,0,0,0"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsChecked" Value="True">
                <Setter TargetName="tr" Property="Background" Value="#34C759"/>
                <Setter TargetName="th" Property="HorizontalAlignment" Value="Right"/>
                <Setter TargetName="th" Property="Margin" Value="0,0,2,0"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="BtnDanger" TargetType="Button" BasedOn="{StaticResource Btn}">
      <Setter Property="Foreground" Value="#FF453A"/>
    </Style>

    <Style TargetType="TextBox">
      <Setter Property="Padding" Value="8,6"/>
      <Setter Property="Background" Value="#1C1C1E"/>
      <Setter Property="Foreground" Value="#F5F5F7"/>
      <Setter Property="CaretBrush" Value="#F5F5F7"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="TextBox">
            <Border x:Name="bd" Background="{TemplateBinding Background}" BorderBrush="#3A3A3C"
                    BorderThickness="1" CornerRadius="8" Padding="{TemplateBinding Padding}">
              <ScrollViewer x:Name="PART_ContentHost"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsKeyboardFocused" Value="True"><Setter TargetName="bd" Property="BorderBrush" Value="#0A84FF"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>

    <Style TargetType="ListBoxItem">
      <Setter Property="Foreground" Value="#F5F5F7"/>
      <Setter Property="Padding" Value="10,6"/>
      <Setter Property="Margin" Value="0,1"/>
      <Setter Property="HorizontalContentAlignment" Value="Stretch"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="ListBoxItem">
            <Border x:Name="bd" CornerRadius="7" Background="Transparent" Padding="{TemplateBinding Padding}">
              <ContentPresenter/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="bd" Property="Background" Value="#10FFFFFF"/></Trigger>
              <Trigger Property="IsSelected" Value="True"><Setter TargetName="bd" Property="Background" Value="#17407A"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="SegTab" TargetType="RadioButton">
      <Setter Property="Foreground" Value="#D1D1D6"/>
      <Setter Property="Padding" Value="10,4"/>
      <Setter Property="MinWidth" Value="88"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="RadioButton">
            <Border x:Name="b" CornerRadius="10" Background="Transparent" Padding="{TemplateBinding Padding}" MinWidth="{TemplateBinding MinWidth}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="b" Property="Background" Value="#14FFFFFF"/></Trigger>
              <Trigger Property="IsChecked" Value="True">
                <Setter TargetName="b" Property="Background" Value="#1C1C1E"/>
                <Setter Property="FontWeight" Value="SemiBold"/>
                <Setter TargetName="b" Property="Effect">
                  <Setter.Value><DropShadowEffect BlurRadius="4" ShadowDepth="1" Opacity="0.22" Color="Black"/></Setter.Value>
                </Setter>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="RowBtn" TargetType="Button">
      <Setter Property="Foreground" Value="#F5F5F7"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="HorizontalContentAlignment" Value="Stretch"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="b" Background="Transparent" Padding="12,9">
              <ContentPresenter HorizontalAlignment="Stretch" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="b" Property="Background" Value="#0DFFFFFF"/></Trigger>
              <Trigger Property="IsPressed" Value="True"><Setter TargetName="b" Property="Background" Value="#1AFFFFFF"/></Trigger>
              <Trigger Property="IsEnabled" Value="False"><Setter TargetName="b" Property="Opacity" Value="0.4"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="Caption" TargetType="TextBlock">
      <Setter Property="Foreground" Value="#8E8E93"/>
      <Setter Property="FontSize" Value="10.5"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
      <Setter Property="Margin" Value="4,16,0,6"/>
    </Style>

    <!-- ===== Datum Navigation Tabs (colored icon tiles + label) ===== -->
    <Style x:Key="IslandTab" TargetType="RadioButton">
      <Setter Property="Foreground" Value="#8E8E93"/>
      <Setter Property="BorderBrush" Value="#0071E3"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Margin" Value="1,0"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="RadioButton">
            <Border x:Name="b" Height="30" MinWidth="34" CornerRadius="9" Background="Transparent" Padding="5,0">
              <StackPanel Orientation="Horizontal" HorizontalAlignment="Center" VerticalAlignment="Center">
                <Border Width="21" Height="21" CornerRadius="6" Background="{TemplateBinding BorderBrush}" VerticalAlignment="Center">
                  <TextBlock x:Name="ic" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" FontSize="11.5"
                             Text="{TemplateBinding Content}" Foreground="#FFFFFF"
                             HorizontalAlignment="Center" VerticalAlignment="Center"/>
                </Border>
                <TextBlock x:Name="lb" Text="{TemplateBinding Tag}" Visibility="Collapsed" Margin="7,0,4,0"
                           FontWeight="SemiBold" FontSize="12" Foreground="#F5F5F7" VerticalAlignment="Center"/>
              </StackPanel>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter TargetName="b" Property="Background" Value="#1F1F22"/>
              </Trigger>
              <Trigger Property="IsChecked" Value="True">
                <Setter TargetName="b" Property="Background" Value="#2C2C2E"/>
                <Setter TargetName="lb" Property="Visibility" Value="Visible"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="RoundBtn" TargetType="Button">
      <Setter Property="Foreground" Value="#C7C7CC"/>
      <Setter Property="Width" Value="32"/>
      <Setter Property="Height" Value="32"/>
      <Setter Property="Margin" Value="0,0,6,0"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="b" CornerRadius="16" Background="#161618" BorderBrush="#26FFFFFF" BorderThickness="1">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"
                                TextElement.FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets"
                                TextElement.FontSize="13" TextElement.Foreground="{TemplateBinding Foreground}"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="b" Property="Background" Value="#2C2C2E"/></Trigger>
              <Trigger Property="IsPressed" Value="True"><Setter TargetName="b" Property="Background" Value="#3A3A3C"/></Trigger>
              <Trigger Property="IsEnabled" Value="False"><Setter TargetName="b" Property="Opacity" Value="0.4"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style x:Key="RoundBorder" TargetType="Border">
      <Setter Property="Width" Value="32"/>
      <Setter Property="Height" Value="32"/>
      <Setter Property="CornerRadius" Value="16"/>
      <Setter Property="Background" Value="#161618"/>
      <Setter Property="BorderBrush" Value="#26FFFFFF"/>
      <Setter Property="BorderThickness" Value="1"/>
      <Setter Property="Margin" Value="0,0,6,0"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Style.Triggers>
        <Trigger Property="IsMouseOver" Value="True"><Setter Property="Background" Value="#2C2C2E"/></Trigger>
      </Style.Triggers>
    </Style>
    <Style x:Key="RoundBorderClose" TargetType="Border" BasedOn="{StaticResource RoundBorder}">
      <Setter Property="Margin" Value="0"/>
      <Style.Triggers>
        <Trigger Property="IsMouseOver" Value="True"><Setter Property="Background" Value="#FF453A"/></Trigger>
      </Style.Triggers>
    </Style>
    <Style x:Key="HomeTile" TargetType="Button">
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Foreground" Value="#F5F5F7"/>
      <Setter Property="Margin" Value="0,0,10,10"/>
      <Setter Property="Width" Value="196"/>
      <Setter Property="HorizontalContentAlignment" Value="Stretch"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="b" Background="#111113" BorderBrush="#1F1F22" BorderThickness="1"
                    CornerRadius="22" Padding="14">
              <ContentPresenter/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter TargetName="b" Property="Background" Value="#1C1C1E"/>
                <Setter TargetName="b" Property="BorderBrush" Value="#3A3A3C"/>
              </Trigger>
              <Trigger Property="IsPressed" Value="True"><Setter TargetName="b" Property="Background" Value="#26262A"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
@COMMON@
  </Window.Resources>

  <Grid>
    <!-- ====================== ISLAND ====================== -->
    <!-- shadow on the outer element: ClipToBounds on the same element would cut it to a rectangle -->
    <Border x:Name="islandFx" Margin="28,0,28,28" HorizontalAlignment="Center" VerticalAlignment="Top">
      <Border.Effect>
        <DropShadowEffect BlurRadius="20" ShadowDepth="3" Direction="270" Opacity="0.5" Color="Black"/>
      </Border.Effect>
    <Grid>
    <!-- concave "smooth" transitions in the top corners: the island seems to flow into the top of the screen -->
    <Path x:Name="islandFilletL" Width="19" Height="18" HorizontalAlignment="Left" VerticalAlignment="Top"
          Margin="-18,0,0,0" Fill="#000000" Data="M 0,0 L 19,0 L 19,18 L 18,18 A 18,18 0 0 0 0,0 Z" IsHitTestVisible="False"/>
    <Path x:Name="islandFilletR" Width="19" Height="18" HorizontalAlignment="Right" VerticalAlignment="Top"
          Margin="0,0,-18,0" Fill="#000000" Data="M 0,0 L 19,0 A 18,18 0 0 0 1,18 L 0,18 Z" IsHitTestVisible="False"/>
    <Border x:Name="island" Width="1000" Height="680"
            CornerRadius="0,0,36,36" Background="#000000" BorderThickness="0" ClipToBounds="True">
      <Grid>

        <!-- ===== Collapsed state: pill ===== -->
        <Grid x:Name="islandPill" Height="34" VerticalAlignment="Top" Background="Transparent"
              Cursor="Hand" Visibility="Collapsed" Opacity="0" ToolTip="Expand Datum Toolkit">
          <Border x:Name="pillHover" CornerRadius="0,0,17,17" Background="#FFFFFF" Opacity="0" IsHitTestVisible="False"/>
          <StackPanel x:Name="pillLeft" Orientation="Horizontal" HorizontalAlignment="Left" VerticalAlignment="Center" Margin="12,0,0,2">
            <Border Width="22" Height="22" CornerRadius="6">
              <Border.Background>
                <LinearGradientBrush StartPoint="0,0" EndPoint="1,1">
                  <GradientStop Color="#2997FF" Offset="0"/>
                  <GradientStop Color="#0A84FF" Offset="0.55"/>
                  <GradientStop Color="#5E5CE6" Offset="1"/>
                </LinearGradientBrush>
              </Border.Background>
              <Viewbox Width="16" Height="16">
                <Grid Width="32" Height="32">
                  <Path Fill="#FFFFFF" Data="F0 M9,9 H15.8 C20,9 23,11.8 23,16 C23,20.2 20,23 15.8,23 H9 Z M12,11.8 V20.2 H15.6 C18.1,20.2 19.8,18.6 19.8,16 C19.8,13.4 18.1,11.8 15.6,11.8 Z"/>
                </Grid>
              </Viewbox>
            </Border>
            <TextBlock Text="Datum" Margin="8,0,0,0" FontSize="12.5" FontWeight="Bold" Foreground="#F5F5F7"
                       VerticalAlignment="Center"/>
            <Border x:Name="pillInfo" Width="18" Height="18" CornerRadius="9" Background="#2C2C2E" Margin="9,1,0,0"
                    Cursor="Hand" ToolTip="Show the Revit project name">
              <TextBlock Text="i" FontSize="11" FontWeight="Bold" Foreground="#98989D"
                         HorizontalAlignment="Center" VerticalAlignment="Center" Margin="0,-1,0,0"/>
            </Border>
          </StackPanel>
          <StackPanel x:Name="pillRight" Orientation="Horizontal" HorizontalAlignment="Right" VerticalAlignment="Center" Margin="0,0,14,2">
            <TextBlock x:Name="tbPillTab" Text="Home" FontSize="11.5" Foreground="#98989D" Margin="0,0,7,0"
                       VerticalAlignment="Center"/>
            <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE70D;" FontSize="10"
                       Foreground="#98989D" VerticalAlignment="Center"/>
          </StackPanel>
          <!-- print / export progress -->
          <Grid x:Name="pillProgBox" VerticalAlignment="Bottom" Height="3" Margin="14,0,14,3"
                Visibility="Collapsed" IsHitTestVisible="False">
            <Border Background="#2C2C2E" CornerRadius="1.5"/>
            <Border x:Name="pillProgFill" Background="#2997FF" CornerRadius="1.5" HorizontalAlignment="Left" Width="0"/>
          </Grid>
          <!-- work in progress (print / export / audit): icon, action, a wide bar, value -->
          <Grid x:Name="pillProgRow" Visibility="Collapsed" Margin="12,0,14,2" VerticalAlignment="Center" IsHitTestVisible="False">
            <Grid.ColumnDefinitions>
              <ColumnDefinition Width="Auto"/>
              <ColumnDefinition Width="Auto"/>
              <ColumnDefinition Width="*"/>
              <ColumnDefinition Width="Auto"/>
            </Grid.ColumnDefinitions>
            <Border Grid.Column="0" Width="22" Height="22" CornerRadius="11" Background="#0071E3">
              <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE90F;" Foreground="#FFFFFF"
                         FontSize="11" HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <TextBlock x:Name="tbProgVerb" Grid.Column="1" Margin="9,0,0,0" FontSize="11.5" FontWeight="SemiBold"
                       Foreground="#F5F5F7" VerticalAlignment="Center"/>
            <Grid Grid.Column="2" Height="6" Margin="10,1,10,0" VerticalAlignment="Center">
              <Border Background="#2C2C2E" CornerRadius="3"/>
              <Border x:Name="pillProgBar" Background="#2997FF" CornerRadius="3" RenderTransformOrigin="0,0.5">
                <Border.RenderTransform>
                  <ScaleTransform ScaleX="0" ScaleY="1"/>
                </Border.RenderTransform>
              </Border>
            </Grid>
            <TextBlock x:Name="tbProgVal" Grid.Column="3" MinWidth="34" TextAlignment="Right" FontSize="11.5"
                       Foreground="#F5F5F7" VerticalAlignment="Center"/>
          </Grid>
          <!-- "i" mode: the pill expands and shows the Revit window title -->
          <Grid x:Name="pillInfoRow" Visibility="Collapsed">
            <Border x:Name="pillInfoBack" Width="18" Height="18" CornerRadius="9" Background="#0071E3"
                    HorizontalAlignment="Left" VerticalAlignment="Center" Margin="12,0,0,2" Cursor="Hand"
                    ToolTip="Hide the project name">
              <TextBlock Text="i" FontSize="11" FontWeight="Bold" Foreground="#FFFFFF"
                         HorizontalAlignment="Center" VerticalAlignment="Center" Margin="0,-1,0,0"/>
            </Border>
            <TextBlock x:Name="pillTitle" Margin="40,0,18,2" FontSize="11.5" Foreground="#F5F5F7"
                       VerticalAlignment="Center" HorizontalAlignment="Left" TextTrimming="CharacterEllipsis"
                       IsHitTestVisible="False"/>
          </Grid>
        </Grid>

        <!-- ===== Expanded state ===== -->
        <Grid x:Name="islandBody" Width="998" Height="678" HorizontalAlignment="Center" VerticalAlignment="Top">
          <Grid.ColumnDefinitions>
            <ColumnDefinition Width="290"/>
            <ColumnDefinition Width="*"/>
          </Grid.ColumnDefinitions>
          <Grid.RowDefinitions>
            <RowDefinition Height="74"/>
            <RowDefinition Height="*"/>
          </Grid.RowDefinitions>

          <!-- ===== Datum Topbar Header ===== -->
          <Grid Grid.Row="0" Grid.ColumnSpan="2" Margin="18,16,18,8">
            <Grid.RowDefinitions>
              <RowDefinition Height="46"/>
              <RowDefinition Height="*"/>
            </Grid.RowDefinitions>
            <Grid.ColumnDefinitions>
              <ColumnDefinition Width="Auto"/>
              <ColumnDefinition Width="*"/>
              <ColumnDefinition Width="Auto"/>
            </Grid.ColumnDefinitions>
            <Border x:Name="dragA" Grid.ColumnSpan="3" Grid.RowSpan="2" Background="Transparent" Margin="-18,-16,-18,-8"/>
            <Border x:Name="dragB" Grid.Column="1" Background="Transparent"/>

            <StackPanel Grid.Column="0" Orientation="Horizontal" VerticalAlignment="Center">
              <Border x:Name="btnDatumBrand" Height="32" CornerRadius="10" Background="Transparent" Padding="0,0,6,0"
                      Margin="0,0,2,0" Cursor="Hand" ToolTip="Datum — Home Dashboard">
                <StackPanel Orientation="Horizontal" VerticalAlignment="Center">
                  <Border Width="26" Height="26" CornerRadius="7">
                    <Border.Background>
                      <LinearGradientBrush StartPoint="0,0" EndPoint="1,1">
                        <GradientStop Color="#2997FF" Offset="0"/>
                        <GradientStop Color="#0A84FF" Offset="0.55"/>
                        <GradientStop Color="#5E5CE6" Offset="1"/>
                      </LinearGradientBrush>
                    </Border.Background>
                    <Viewbox Width="22" Height="22">
                      <Grid Width="32" Height="32">
                        <Path Stroke="#80FFFFFF" StrokeThickness="1.4" StrokeStartLineCap="Round" StrokeEndLineCap="Round"
                              Data="M16,4 L16,7.5 M16,24.5 L16,28 M4,16 L7.5,16 M24.5,16 L28,16"/>
                        <Path Fill="#FFFFFF" Data="F0 M9,9 H15.8 C20,9 23,11.8 23,16 C23,20.2 20,23 15.8,23 H9 Z M12,11.8 V20.2 H15.6 C18.1,20.2 19.8,18.6 19.8,16 C19.8,13.4 18.1,11.8 15.6,11.8 Z"/>
                        <Ellipse Width="4" Height="4" Fill="#FFFFFF" HorizontalAlignment="Center" VerticalAlignment="Center" Margin="2,0,0,0"/>
                      </Grid>
                    </Viewbox>
                  </Border>
                  <TextBlock Text="Datum" FontSize="14.5" FontWeight="Bold" Foreground="#F5F5F7"
                             Margin="6,0,0,0" VerticalAlignment="Center"/>
                </StackPanel>
              </Border>
              <Border x:Name="tabStrip" Background="#161618" BorderBrush="#26FFFFFF" BorderThickness="1"
                      CornerRadius="12" Padding="3" VerticalAlignment="Center">
                <StackPanel Orientation="Horizontal">
                  <RadioButton x:Name="tabHome" GroupName="tabs" IsChecked="True" Style="{StaticResource IslandTab}" BorderBrush="#0071E3" Content="&#xE80F;" Tag="Home" ToolTip="Datum Dashboard &amp; Revit Home"/>
                  <RadioButton x:Name="tabPrint" GroupName="tabs" Style="{StaticResource IslandTab}" BorderBrush="#5E5CE6" Content="&#xE749;" Tag="Print Sets" ToolTip="Print Sets: sheet sets, print, export"/>
                  <RadioButton x:Name="tabNm" GroupName="tabs" Style="{StaticResource IslandTab}" BorderBrush="#34C759" Content="&#xE8A5;" Tag="Views" ToolTip="View naming"/>
                  <RadioButton x:Name="tabTile" GroupName="tabs" Style="{StaticResource IslandTab}" BorderBrush="#FF9F0A" Content="&#xE80A;" Tag="Params" ToolTip="Params: element parameters"/>
                  <RadioButton x:Name="tabAnn" GroupName="tabs" Style="{StaticResource IslandTab}" BorderBrush="#EC4899" Content="&#xE8EC;" Tag="Annotations" ToolTip="Annotations: annotation library"/>
                  <RadioButton x:Name="tabMod" GroupName="tabs" Style="{StaticResource IslandTab}" BorderBrush="#BF5AF2" Content="&#xE943;" Tag="Modules" ToolTip="Modules: custom .py scripts"/>
                  <RadioButton x:Name="tabTools" Visibility="Collapsed" GroupName="tabs" Style="{StaticResource IslandTab}" BorderBrush="#0A84FF" Content="&#xE90F;" Tag="Tools" ToolTip="Tools: Elevation markers and views"/>
                </StackPanel>
              </Border>
            </StackPanel>

            <StackPanel Grid.Column="2" Grid.Row="0" Orientation="Horizontal" VerticalAlignment="Center">
              <Border x:Name="btnHdrSearch" Width="32" Height="32" CornerRadius="16" Background="#161618"
                      BorderBrush="#26FFFFFF" BorderThickness="1" Margin="0,0,6,0" Cursor="Hand"
                      ToolTip="Search Datum Standards &amp; Commands (Ctrl+K)">
                <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE721;" FontSize="12.5"
                           Foreground="#C7C7CC" HorizontalAlignment="Center" VerticalAlignment="Center"/>
              </Border>
              <Border x:Name="btnDatumAuth" Height="32" CornerRadius="16" Background="#161618" BorderBrush="#2997FF"
                      BorderThickness="1" Padding="10,0" Margin="0,0,6,0" Cursor="Hand"
                      ToolTip="Datum Account: Sign in / Switch user">
                <StackPanel Orientation="Horizontal" VerticalAlignment="Center">
                  <Ellipse Width="7" Height="7" Fill="#2997FF" Margin="0,0,6,0" VerticalAlignment="Center"/>
                  <TextBlock x:Name="tbDatumAuth" Text="Sign in" MaxWidth="92" TextTrimming="CharacterEllipsis"
                             FontSize="11.5" FontWeight="SemiBold" Foreground="#2997FF" VerticalAlignment="Center"/>
                </StackPanel>
              </Border>
              <Border Height="32" CornerRadius="16" Background="#161618" BorderBrush="#26FFFFFF" BorderThickness="1"
                      Padding="10,0" Margin="0,0,6,0">
                <StackPanel Orientation="Horizontal" VerticalAlignment="Center">
                  <Ellipse Width="7" Height="7" Fill="#34C759" Margin="0,0,6,0" VerticalAlignment="Center"/>
                  <TextBlock x:Name="tbDocChip" Text="Revit" MaxWidth="88" TextTrimming="CharacterEllipsis"
                             FontSize="11.5" FontWeight="SemiBold" Foreground="#E5E5EA" VerticalAlignment="Center"/>
                </StackPanel>
              </Border>
              <Button x:Name="btnRefresh" Style="{StaticResource RoundBtn}" Content="&#xE72C;"
                      ToolTip="Re-index sets and sheets from Revit"/>
              <Border x:Name="btnPin" Style="{StaticResource RoundBorder}" ToolTip="Always on top: on/off">
                <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE718;" Foreground="#C7C7CC"
                           FontSize="13" HorizontalAlignment="Center" VerticalAlignment="Center"/>
              </Border>
              <Border x:Name="swMode" Height="32" CornerRadius="16" Background="#161618" BorderBrush="#26FFFFFF" BorderThickness="1"
                      Padding="2" Margin="2,0,6,0" VerticalAlignment="Center"
                      ToolTip="What the collapse button does: Panel = a bar at the top of the screen, Icon = a small icon in the Revit title bar">
                <StackPanel Orientation="Horizontal">
                  <Border x:Name="swPanel" Height="26" CornerRadius="13" Background="#0071E3" Padding="9,0" Cursor="Hand">
                    <StackPanel Orientation="Horizontal" VerticalAlignment="Center">
                      <TextBlock x:Name="swPanelIc" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE7C4;" FontSize="11"
                                 Foreground="#FFFFFF" VerticalAlignment="Center" Margin="0,0,5,0"/>
                      <TextBlock x:Name="swPanelTx" Text="Panel" FontSize="11.5" FontWeight="SemiBold" Foreground="#FFFFFF" VerticalAlignment="Center"/>
                    </StackPanel>
                  </Border>
                  <Border x:Name="swIcon" Height="26" CornerRadius="13" Background="Transparent" Padding="9,0" Cursor="Hand">
                    <StackPanel Orientation="Horizontal" VerticalAlignment="Center">
                      <TextBlock x:Name="swIconIc" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE90F;" FontSize="11"
                                 Foreground="#98989D" VerticalAlignment="Center" Margin="0,0,5,0"/>
                      <TextBlock x:Name="swIconTx" Text="Icon" FontSize="11.5" FontWeight="SemiBold" Foreground="#98989D" VerticalAlignment="Center"/>
                    </StackPanel>
                  </Border>
                </StackPanel>
              </Border>
              <Border x:Name="btnCompact" Style="{StaticResource RoundBorder}" ToolTip="Collapse (into the panel bar or the icon - see the switch on the left)">
                <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE70E;" Foreground="#C7C7CC"
                           FontSize="13" HorizontalAlignment="Center" VerticalAlignment="Center"/>
              </Border>
              <Border x:Name="btnClose" Style="{StaticResource RoundBorderClose}" Margin="2,0,0,0" ToolTip="Close (two clicks: the first one only 'arms' the button)">
                <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE711;" Foreground="#C7C7CC"
                           FontSize="12" HorizontalAlignment="Center" VerticalAlignment="Center"/>
              </Border>
            </StackPanel>
            <StackPanel Grid.Row="1" Grid.ColumnSpan="3" Orientation="Horizontal" VerticalAlignment="Center" Margin="0,4,0,0" Visibility="Collapsed">
              <Border x:Name="btnHdrAnnBar" Style="{StaticResource RoundBorder}" Width="Auto" Height="34" CornerRadius="17" Padding="13,0" ToolTip="Annotations strip: quick placement over Revit (lit when open)">
                <StackPanel Orientation="Horizontal" VerticalAlignment="Center">
                  <TextBlock x:Name="icHdrAnnBar" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE8A7;" Foreground="#C7C7CC" FontSize="13" VerticalAlignment="Center"/>
                  <TextBlock Text="Annotations" FontSize="12" FontWeight="SemiBold" Foreground="#C7C7CC" Margin="8,0,0,0" VerticalAlignment="Center"/>
                </StackPanel>
              </Border>
              <Border x:Name="btnHdrView" Style="{StaticResource RoundBorder}" Width="Auto" Height="34" CornerRadius="17" Padding="13,0" ToolTip="View → Sheet: strip for creating views on a sheet. Right-click - Project Browser parameters">
                <StackPanel Orientation="Horizontal" VerticalAlignment="Center">
                  <TextBlock x:Name="icHdrView" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE722;" Foreground="#C7C7CC" FontSize="13" VerticalAlignment="Center"/>
                  <TextBlock Text="View → Sheet" FontSize="12" FontWeight="SemiBold" Foreground="#C7C7CC" Margin="8,0,0,0" VerticalAlignment="Center"/>
                </StackPanel>
              </Border>
              <Border x:Name="btnHdrMove" Style="{StaticResource RoundBorder}" Width="Auto" Height="34" CornerRadius="17" Padding="13,0" ToolTip="Move marker: the marker moves, the view crop and line stay in place">
                <StackPanel Orientation="Horizontal" VerticalAlignment="Center">
                  <TextBlock x:Name="icHdrMove" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE7C2;" Foreground="#C7C7CC" FontSize="13" VerticalAlignment="Center"/>
                  <TextBlock Text="Move marker" FontSize="12" FontWeight="SemiBold" Foreground="#C7C7CC" Margin="8,0,0,0" VerticalAlignment="Center"/>
                </StackPanel>
              </Border>
              <Border x:Name="btnHdrSnap" Style="{StaticResource RoundBorder}" Width="Auto" Height="34" CornerRadius="17" Padding="13,0" ToolTip="Align Elevation markers to a straight angle (select markers on the plan)">
                <StackPanel Orientation="Horizontal" VerticalAlignment="Center">
                  <TextBlock x:Name="icHdrSnap" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE7AD;" Foreground="#C7C7CC" FontSize="13" VerticalAlignment="Center"/>
                  <TextBlock Text="Align markers" FontSize="12" FontWeight="SemiBold" Foreground="#C7C7CC" Margin="8,0,0,0" VerticalAlignment="Center"/>
                </StackPanel>
              </Border>
            </StackPanel>
            <Button x:Name="btnSide" Grid.Column="1" Style="{StaticResource IconBtn}" Content="&#xE700;"
                    Visibility="Collapsed" Width="0" Height="0"/>
          </Grid>

      <!-- ============ Shared sets sidebar (Print Sets and Views) ============ -->
      <Border Grid.Row="1" Grid.Column="0" Margin="22,4,0,20" CornerRadius="26" Background="#111113"
              Visibility="{Binding Visibility, ElementName=sideSets}"/>
      <Grid x:Name="sideSets" Grid.Row="1" Grid.Column="0" Margin="44,26,22,42" Visibility="Collapsed">
        <Grid.RowDefinitions>
          <RowDefinition Height="Auto"/>
          <RowDefinition Height="*"/>
          <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>
        <Grid Grid.Row="0" Margin="0,0,0,8">
          <TextBox x:Name="tbSetSearch"/>
          <TextBlock x:Name="hSetSearch" Text="Search sets…" Foreground="#8E8E93"
                     Margin="10,0,0,0" VerticalAlignment="Center" IsHitTestVisible="False"/>
        </Grid>
        <ListBox x:Name="lstSets" Grid.Row="1" Background="Transparent" BorderThickness="0"
                 ScrollViewer.HorizontalScrollBarVisibility="Disabled"/>
        <Grid Grid.Row="2" Margin="0,10,0,0">
          <TextBox x:Name="tbNew" Padding="10,8,42,8"/>
          <TextBlock x:Name="hNew" Text="New set from selection…" Foreground="#8E8E93"
                     Margin="11,0,0,0" VerticalAlignment="Center" IsHitTestVisible="False"/>
          <Button x:Name="btnCreate" Style="{StaticResource IconBtnPrimary}" Content="&#xE710;"
                  HorizontalAlignment="Right" VerticalAlignment="Center" Width="28" Height="28"
                  Margin="0,0,4,0" FontSize="12"
                  ToolTip="Create a set from the sheets selected in Revit (Enter)"/>
        </Grid>
      </Grid>

      <!-- ============ Home ============ -->
      <Grid x:Name="pageHome" Grid.Row="1" Grid.ColumnSpan="2" Margin="22,4,22,20">
        <Grid.ColumnDefinitions>
          <ColumnDefinition Width="290"/>
          <ColumnDefinition Width="*"/>
        </Grid.ColumnDefinitions>

        <Border Grid.Column="0" Margin="0,0,22,0" CornerRadius="22" Background="#141416"
                BorderBrush="#26FFFFFF" BorderThickness="1" Padding="16">
          <Grid>
            <Grid.RowDefinitions>
              <RowDefinition Height="Auto"/>
              <RowDefinition Height="Auto"/>
              <RowDefinition Height="*"/>
              <RowDefinition Height="Auto"/>
            </Grid.RowDefinitions>
            <StackPanel Grid.Row="0">
              <TextBlock Style="{StaticResource Caption}" Margin="4,0,0,6" Text="DATUM SPACES"/>
              <Border x:Name="btnDatumNavLookup" CornerRadius="9" Background="Transparent" Padding="8,6" Margin="0,0,0,2" Cursor="Hand">
                <DockPanel>
                  <Border DockPanel.Dock="Left" Width="22" Height="22" CornerRadius="6" Background="#0071E3" Margin="0,0,9,0">
                    <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE721;" Foreground="#FFFFFF"
                               FontSize="11.5" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                  </Border>
                  <Border DockPanel.Dock="Right" CornerRadius="5" Background="#1F1F22" Padding="6,2" VerticalAlignment="Center">
                    <TextBlock Text="Ctrl+K" FontSize="10" FontWeight="SemiBold" Foreground="#A1A1A6"/>
                  </Border>
                  <TextBlock Text="Standards Lookup" FontSize="12.5" FontWeight="SemiBold" Foreground="#F5F5F7" VerticalAlignment="Center"/>
                </DockPanel>
              </Border>
              <Border x:Name="btnDatumNav3D" CornerRadius="9" Background="Transparent" Padding="8,6" Margin="0,0,0,2" Cursor="Hand">
                <DockPanel>
                  <Border DockPanel.Dock="Left" Width="22" Height="22" CornerRadius="6" Background="#5E5CE6" Margin="0,0,9,0">
                    <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE81E;" Foreground="#FFFFFF"
                               FontSize="11.5" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                  </Border>
                  <TextBlock DockPanel.Dock="Right" Text="4" FontSize="11" Foreground="#8E8E93" VerticalAlignment="Center" Margin="6,0,2,0"/>
                  <TextBlock Text="3D Assemblies" FontSize="12.5" FontWeight="SemiBold" Foreground="#F5F5F7" VerticalAlignment="Center"/>
                </DockPanel>
              </Border>
              <Border x:Name="btnDatumNavWall" CornerRadius="9" Background="Transparent" Padding="8,6" Margin="0,0,0,2" Cursor="Hand">
                <DockPanel>
                  <Border DockPanel.Dock="Left" Width="22" Height="22" CornerRadius="6" Background="#EC4899" Margin="0,0,9,0">
                    <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE8B9;" Foreground="#FFFFFF"
                               FontSize="11.5" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                  </Border>
                  <TextBlock DockPanel.Dock="Right" Text="2D" FontSize="11" Foreground="#8E8E93" VerticalAlignment="Center" Margin="6,0,2,0"/>
                  <TextBlock Text="Detail Wall" FontSize="12.5" FontWeight="SemiBold" Foreground="#F5F5F7" VerticalAlignment="Center"/>
                </DockPanel>
              </Border>
              <Border x:Name="btnDatumNavKb" CornerRadius="9" Background="Transparent" Padding="8,6" Margin="0,0,0,4" Cursor="Hand">
                <DockPanel>
                  <Border DockPanel.Dock="Left" Width="22" Height="22" CornerRadius="6" Background="#0A84FF" Margin="0,0,9,0">
                    <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE8F1;" Foreground="#FFFFFF"
                               FontSize="11.5" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                  </Border>
                  <TextBlock DockPanel.Dock="Right" Text="Web" FontSize="11" Foreground="#8E8E93" VerticalAlignment="Center" Margin="6,0,2,0"/>
                  <TextBlock Text="Knowledge Base" FontSize="12.5" FontWeight="SemiBold" Foreground="#F5F5F7" VerticalAlignment="Center"/>
                </DockPanel>
              </Border>
            </StackPanel>

            <StackPanel Grid.Row="1" Margin="0,8,0,0">
              <Border Height="1" Background="#1F1F22" Margin="0,0,0,10"/>
              <TextBlock Style="{StaticResource Caption}" Margin="4,0,0,4" Text="REVIT PROJECT"/>
              <TextBlock x:Name="tbHomeDoc" FontSize="16.5" FontWeight="Bold" Foreground="#F5F5F7" TextWrapping="Wrap"
                         Margin="4,0,0,0" Text="No project connected"/>
              <Grid Margin="0,10,0,0">
                <Grid.ColumnDefinitions>
                  <ColumnDefinition Width="*"/>
                  <ColumnDefinition Width="8"/>
                  <ColumnDefinition Width="*"/>
                </Grid.ColumnDefinitions>
                <Border Grid.Column="0" CornerRadius="14" Background="#1C1C1E" BorderBrush="#26FFFFFF" BorderThickness="1" Padding="12,9">
                  <StackPanel>
                    <TextBlock x:Name="tbHomeSets" FontSize="24" FontWeight="Bold" Foreground="#F5F5F7" Text="0"/>
                    <TextBlock Foreground="#8E8E93" FontSize="11" Text="sheet sets"/>
                  </StackPanel>
                </Border>
                <Border Grid.Column="2" CornerRadius="14" Background="#1C1C1E" BorderBrush="#26FFFFFF" BorderThickness="1" Padding="12,9">
                  <StackPanel>
                    <TextBlock x:Name="tbHomeSel" FontSize="24" FontWeight="Bold" Foreground="#2997FF" Text="0"/>
                    <TextBlock Foreground="#8E8E93" FontSize="11" Text="views selected"/>
                  </StackPanel>
                </Border>
              </Grid>
            </StackPanel>

            <StackPanel Grid.Row="2" Margin="4,10,0,0" VerticalAlignment="Top">
              <TextBlock x:Name="tbHomeStatus" Foreground="#8E8E93" FontSize="11" TextWrapping="Wrap" MinHeight="14"/>
              <WrapPanel x:Name="pnlHomeErr" Margin="0,6,0,0"/>
            </StackPanel>

            <Border x:Name="btnDatumSideUser" Grid.Row="3" Margin="0,8,0,0" CornerRadius="14"
                    Background="#1C1C1E" BorderBrush="#26FFFFFF" BorderThickness="1" Padding="10,8" Cursor="Hand"
                    ToolTip="Datum Account: Sign in or switch workspace user">
              <DockPanel>
                <Border DockPanel.Dock="Left" Width="32" Height="32" CornerRadius="16" Margin="0,0,10,0">
                  <Border.Background>
                    <LinearGradientBrush StartPoint="0,0" EndPoint="1,1">
                      <GradientStop Color="#2997FF" Offset="0"/>
                      <GradientStop Color="#5E5CE6" Offset="1"/>
                    </LinearGradientBrush>
                  </Border.Background>
                  <TextBlock x:Name="tbDatumAvatar" Text="DT" FontSize="12" FontWeight="Bold" Foreground="#FFFFFF"
                             HorizontalAlignment="Center" VerticalAlignment="Center"/>
                </Border>
                <TextBlock DockPanel.Dock="Right" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE76C;"
                           FontSize="10" Foreground="#8E8E93" VerticalAlignment="Center" Margin="6,0,2,0"/>
                <StackPanel VerticalAlignment="Center">
                  <TextBlock x:Name="tbDatumUserTitle" Text="Sign in to Datum" FontSize="12.5" FontWeight="SemiBold"
                             Foreground="#F5F5F7" TextTrimming="CharacterEllipsis"/>
                  <TextBlock x:Name="tbDatumUserSub" Text="Sync standards &amp; 3D nodes" FontSize="11"
                             Foreground="#8E8E93" TextTrimming="CharacterEllipsis"/>
                </StackPanel>
              </DockPanel>
            </Border>
          </Grid>
        </Border>

        <ScrollViewer Grid.Column="1" VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled">
          <StackPanel Margin="0,0,6,0">
            <StackPanel Margin="2,0,10,8">
              <TextBlock Text="Datum BIM Standards Hub" FontSize="20" FontWeight="Bold" Foreground="#F5F5F7"/>
              <TextBlock Text="Select any Revit element (Wall, Door, Ceiling) and press Ctrl+K for matching standards &amp; 3D assemblies."
                         Foreground="#8E8E93" FontSize="11.5" Margin="0,2,0,0" TextWrapping="Wrap"/>
            </StackPanel>

            <Border x:Name="btnDatumHeroAsk" CornerRadius="16" Padding="1.5" Margin="0,0,10,12" Cursor="Hand"
                    ToolTip="Open Datum Context Lookup (Ctrl+K)">
              <Border.Background>
                <LinearGradientBrush StartPoint="0,0" EndPoint="1,0.5">
                  <GradientStop Color="#0A84FF" Offset="0"/>
                  <GradientStop Color="#BF5AF2" Offset="0.33"/>
                  <GradientStop Color="#FF6482" Offset="0.66"/>
                  <GradientStop Color="#FF9F0A" Offset="1"/>
                </LinearGradientBrush>
              </Border.Background>
              <Border CornerRadius="14.5" Background="#141416" Padding="14,10">
                <DockPanel>
                  <Border DockPanel.Dock="Right" CornerRadius="9" Background="#0071E3" Padding="12,6" Margin="10,0,0,0" VerticalAlignment="Center">
                    <TextBlock Text="Lookup  Ctrl+K" FontSize="11.5" FontWeight="SemiBold" Foreground="#FFFFFF"/>
                  </Border>
                  <StackPanel Orientation="Horizontal" VerticalAlignment="Center">
                    <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE945;" FontSize="15"
                               Foreground="#2997FF" VerticalAlignment="Center" Margin="0,0,10,0"/>
                    <TextBlock Text="Ask Datum or inspect standard for selected Revit element..."
                               FontSize="12.5" FontWeight="SemiBold" Foreground="#E5E5EA" VerticalAlignment="Center"
                               TextTrimming="CharacterEllipsis"/>
                  </StackPanel>
                </DockPanel>
              </Border>
            </Border>

            <Grid Margin="0,0,10,12">
              <Grid.ColumnDefinitions>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="10"/>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="10"/>
                <ColumnDefinition Width="*"/>
              </Grid.ColumnDefinitions>
              <Border x:Name="btnFeatLookup" Grid.Column="0" CornerRadius="16" Background="#141416"
                      BorderBrush="#26FFFFFF" BorderThickness="1" Padding="13,11" Cursor="Hand">
                <StackPanel>
                  <Border Width="28" Height="28" CornerRadius="8" Background="#0071E3" HorizontalAlignment="Left">
                    <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE721;" Foreground="#FFFFFF"
                               FontSize="13" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                  </Border>
                  <TextBlock Text="Context Lookup" FontSize="13" FontWeight="SemiBold" Foreground="#F5F5F7" Margin="0,8,0,1"/>
                  <TextBlock Text="Selected element + Ctrl+K" FontSize="11" Foreground="#8E8E93" TextTrimming="CharacterEllipsis"/>
                </StackPanel>
              </Border>
              <Border x:Name="btnFeat3D" Grid.Column="2" CornerRadius="16" Background="#141416"
                      BorderBrush="#26FFFFFF" BorderThickness="1" Padding="13,11" Cursor="Hand">
                <StackPanel>
                  <Border Width="28" Height="28" CornerRadius="8" Background="#5E5CE6" HorizontalAlignment="Left">
                    <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE81E;" Foreground="#FFFFFF"
                               FontSize="13" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                  </Border>
                  <TextBlock Text="3D Assemblies" FontSize="13" FontWeight="SemiBold" Foreground="#F5F5F7" Margin="0,8,0,1"/>
                  <TextBlock Text="Exploded wall &amp; door layers" FontSize="11" Foreground="#8E8E93" TextTrimming="CharacterEllipsis"/>
                </StackPanel>
              </Border>
              <Border x:Name="btnFeatWall" Grid.Column="4" CornerRadius="16" Background="#141416"
                      BorderBrush="#26FFFFFF" BorderThickness="1" Padding="13,11" Cursor="Hand">
                <StackPanel>
                  <Border Width="28" Height="28" CornerRadius="8" Background="#EC4899" HorizontalAlignment="Left">
                    <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE8B9;" Foreground="#FFFFFF"
                               FontSize="13" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                  </Border>
                  <TextBlock Text="Detail Wall" FontSize="13" FontWeight="SemiBold" Foreground="#F5F5F7" Margin="0,8,0,1"/>
                  <TextBlock Text="Architectural BIM/CAD nodes" FontSize="11" Foreground="#8E8E93" TextTrimming="CharacterEllipsis"/>
                </StackPanel>
              </Border>
            </Grid>

            <TextBlock Style="{StaticResource Caption}" Margin="4,0,0,6" Text="NOW  ·  REVIT CONTEXT &amp; TOOLS"/>
            <Border Background="#141416" BorderBrush="#26FFFFFF" BorderThickness="1" CornerRadius="18" Padding="16,13,16,8" Margin="0,0,10,12">
              <StackPanel>
                <TextBlock x:Name="tbHomeCtx" FontSize="14.5" FontWeight="SemiBold" Foreground="#F5F5F7" TextWrapping="Wrap"/>
                <TextBlock x:Name="tbHomeCtxSub" Foreground="#8E8E93" FontSize="11.5" TextWrapping="Wrap" Margin="0,2,0,10"/>
                <WrapPanel x:Name="pnlHomeCtx"/>
                <Border Height="1" Background="#1F1F22" Margin="0,2,0,10"/>
                <TextBlock Style="{StaticResource Caption}" Margin="0,0,0,6" Text="DATUM &amp; TOOLKIT QUICK ACTIONS"/>
                <WrapPanel x:Name="pnlToolkitChips"/>
              </StackPanel>
            </Border>
            <TextBlock Style="{StaticResource Caption}" Margin="4,2,0,6" Text="CONTINUE"/>
            <Border Background="#141416" BorderBrush="#26FFFFFF" BorderThickness="1" CornerRadius="18" Padding="16,13,16,6" Margin="0,0,10,12">
              <StackPanel>
                <TextBlock x:Name="tbHomeRecentEmpty" Visibility="Collapsed" Foreground="#8E8E93" FontSize="11.5"
                           TextWrapping="Wrap" Margin="0,0,0,8"
                           Text="The latest sets, sheets and annotations you worked with will appear here."/>
                <TextBlock x:Name="capHomeSets" Text="PRINT SETS" Foreground="#8E8E93" FontSize="10.5" FontWeight="SemiBold" Margin="0,0,0,6"/>
                <WrapPanel x:Name="pnlHomeSets"/>
                <TextBlock x:Name="capHomeSheets" Text="SHEETS" Foreground="#8E8E93" FontSize="10.5" FontWeight="SemiBold" Margin="0,2,0,6"/>
                <WrapPanel x:Name="pnlHomeSheets"/>
                <TextBlock x:Name="capHomeAnns" Text="ANNOTATIONS" Foreground="#8E8E93" FontSize="10.5" FontWeight="SemiBold" Margin="0,2,0,6"/>
                <WrapPanel x:Name="pnlHomeAnns"/>
              </StackPanel>
            </Border>
            <TextBlock Style="{StaticResource Caption}" Margin="4,2,0,6" Text="MODEL HEALTH"/>
            <Border Background="#141416" BorderBrush="#26FFFFFF" BorderThickness="1" CornerRadius="18" Padding="16,13,16,6" Margin="0,0,10,12">
              <StackPanel>
                <TextBlock x:Name="tbAuditStatus" Foreground="#8E8E93" FontSize="11.5" TextWrapping="Wrap"
                           Margin="0,0,8,10"/>
                <WrapPanel x:Name="pnlAuditBtns"/>
                <Grid x:Name="gridAuditProg" Visibility="Collapsed" Height="4" Margin="0,0,8,12">
                  <Border Background="#2C2C2E" CornerRadius="2"/>
                  <Border x:Name="barAuditFill" Background="#2997FF" CornerRadius="2" RenderTransformOrigin="0,0.5">
                    <Border.RenderTransform>
                      <ScaleTransform ScaleX="0" ScaleY="1"/>
                    </Border.RenderTransform>
                  </Border>
                </Grid>
                <Border x:Name="cardRptOpts" Visibility="Collapsed" Background="#1C1C1E" CornerRadius="16"
                        Padding="16,12,16,8" Margin="0,0,8,10">
                  <StackPanel x:Name="pnlRptOpts"/>
                </Border>
                <Border x:Name="cardDeepOpts" Visibility="Collapsed" Background="#1C1C1E" CornerRadius="16"
                        Padding="16,12,16,8" Margin="0,0,8,10">
                  <StackPanel x:Name="pnlDeepOpts"/>
                </Border>
                <WrapPanel x:Name="pnlAuditTiles"/>
                <Border x:Name="cardAuditDetail" Visibility="Collapsed" Background="#1C1C1E" CornerRadius="16"
                        Padding="16,12" Margin="0,0,8,10">
                  <StackPanel>
                    <TextBlock x:Name="tbAuditDetailTitle" FontWeight="SemiBold" FontSize="12.5" Foreground="#F5F5F7"
                               TextWrapping="Wrap" Margin="0,0,0,6"/>
                    <WrapPanel x:Name="pnlAuditDetailBtns" Margin="0,0,0,2"/>
                    <ScrollViewer MaxHeight="280" VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled">
                      <StackPanel>
                        <TextBlock x:Name="tbAuditDetail" FontSize="11.5" Foreground="#D1D1D6" TextWrapping="Wrap"/>
                        <StackPanel x:Name="pnlAuditRows"/>
                      </StackPanel>
                    </ScrollViewer>
                  </StackPanel>
                </Border>
              </StackPanel>
            </Border>
            <TextBlock Style="{StaticResource Caption}" Margin="4,2,0,6" Text="ACTION LOG"/>
            <Border Background="#141416" BorderBrush="#26FFFFFF" BorderThickness="1" CornerRadius="18" Padding="16,13,10,6" Margin="0,0,10,12">
              <StackPanel>
                <TextBlock x:Name="tbLogEmpty" Foreground="#8E8E93" FontSize="11.5" TextWrapping="Wrap" Margin="0,0,0,8"
                           Text="Toolkit actions will appear here: time, result, how many changes were made. The last change in the model can be undone with the Undo button."/>
                <StackPanel x:Name="pnlLog"/>
              </StackPanel>
            </Border>
            <TextBlock Style="{StaticResource Caption}" Margin="4,0,0,8" Text="SHEETS AND PRINTING" Visibility="Collapsed"/>
            <WrapPanel Visibility="Collapsed">
              <Button x:Name="homePrint" Style="{StaticResource HomeTile}">
                <StackPanel>
                  <Border Width="38" Height="38" CornerRadius="12" Background="#0A84FF" HorizontalAlignment="Left">
                    <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE749;" Foreground="White"
                               FontSize="18" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                  </Border>
                  <TextBlock Text="Print Sets" FontWeight="SemiBold" FontSize="14" Margin="0,12,0,2"/>
                  <TextBlock Text="Sheet sets, order, printing and PDF / DWG / DXF export" Foreground="#8E8E93" FontSize="11.5" TextWrapping="Wrap"/>
                </StackPanel>
              </Button>
              <Button x:Name="homeNm" Style="{StaticResource HomeTile}">
                <StackPanel>
                  <Border Width="38" Height="38" CornerRadius="12" Background="#34C759" HorizontalAlignment="Left">
                    <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE8A5;" Foreground="White"
                               FontSize="18" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                  </Border>
                  <TextBlock Text="View naming" FontWeight="SemiBold" FontSize="14" Margin="0,12,0,2"/>
                  <TextBlock Text="View name templates based on project parameters" Foreground="#8E8E93" FontSize="11.5" TextWrapping="Wrap"/>
                </StackPanel>
              </Button>
            </WrapPanel>
            <TextBlock Style="{StaticResource Caption}" Margin="4,10,0,8" Text="PARAMETERS AND ANNOTATIONS" Visibility="Collapsed"/>
            <WrapPanel Visibility="Collapsed">
              <Button x:Name="homeTile" Style="{StaticResource HomeTile}">
                <StackPanel>
                  <Border Width="38" Height="38" CornerRadius="12" Background="#FF9F0A" HorizontalAlignment="Left">
                    <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE80A;" Foreground="White"
                               FontSize="18" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                  </Border>
                  <TextBlock Text="Params" FontWeight="SemiBold" FontSize="14" Margin="0,12,0,2"/>
                  <TextBlock Text="Table of parameters of the selected elements, bulk editing" Foreground="#8E8E93" FontSize="11.5" TextWrapping="Wrap"/>
                </StackPanel>
              </Button>
              <Button x:Name="homeAnn" Style="{StaticResource HomeTile}">
                <StackPanel>
                  <Border Width="38" Height="38" CornerRadius="12" Background="#FF375F" HorizontalAlignment="Left">
                    <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE8EC;" Foreground="White"
                               FontSize="18" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                  </Border>
                  <TextBlock Text="Annotations" FontWeight="SemiBold" FontSize="14" Margin="0,12,0,2"/>
                  <TextBlock Text="Annotation library, sets, favorites, placement" Foreground="#8E8E93" FontSize="11.5" TextWrapping="Wrap"/>
                </StackPanel>
              </Button>
              <Button x:Name="homeAnnBar" Visibility="Collapsed" Style="{StaticResource HomeTile}">
                <StackPanel>
                  <Border Width="38" Height="38" CornerRadius="12" Background="#BF5AF2" HorizontalAlignment="Left">
                    <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE8A7;" Foreground="White"
                               FontSize="18" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                  </Border>
                  <TextBlock Text="Annotations strip" FontWeight="SemiBold" FontSize="14" Margin="0,12,0,2"/>
                  <TextBlock Text="Floating quick-placement panel over Revit" Foreground="#8E8E93" FontSize="11.5" TextWrapping="Wrap"/>
                </StackPanel>
              </Button>
            </WrapPanel>
            <TextBlock Style="{StaticResource Caption}" Margin="4,10,0,8" Text="MARKERS AND VIEWS" Visibility="Collapsed"/>
            <WrapPanel Visibility="Collapsed">
              <Button x:Name="homeSnap" Style="{StaticResource HomeTile}">
                <StackPanel>
                  <Border Width="38" Height="38" CornerRadius="12" Background="#FF9F0A" HorizontalAlignment="Left">
                    <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE7AD;" Foreground="White"
                               FontSize="18" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                  </Border>
                  <TextBlock Text="Align markers" FontWeight="SemiBold" FontSize="14" Margin="0,12,0,2"/>
                  <TextBlock Text="Bring the direction of Elevation markers to a straight angle" Foreground="#8E8E93" FontSize="11.5" TextWrapping="Wrap"/>
                </StackPanel>
              </Button>
              <Button x:Name="homeMove" Style="{StaticResource HomeTile}">
                <StackPanel>
                  <Border Width="38" Height="38" CornerRadius="12" Background="#5856D6" HorizontalAlignment="Left">
                    <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE7C2;" Foreground="White"
                               FontSize="18" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                  </Border>
                  <TextBlock Text="Move marker" FontWeight="SemiBold" FontSize="14" Margin="0,12,0,2"/>
                  <TextBlock Text="The marker moves, the view crop and line stay put" Foreground="#8E8E93" FontSize="11.5" TextWrapping="Wrap"/>
                </StackPanel>
              </Button>
              <Button x:Name="homeView" Style="{StaticResource HomeTile}">
                <StackPanel>
                  <Border Width="38" Height="38" CornerRadius="12" Background="#30B0C7" HorizontalAlignment="Left">
                    <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE722;" Foreground="White"
                               FontSize="18" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                  </Border>
                  <TextBlock Text="View → Sheet" FontWeight="SemiBold" FontSize="14" Margin="0,12,0,2"/>
                  <TextBlock Text="Elevation / Section / Plan from the selection onto a sheet" Foreground="#8E8E93" FontSize="11.5" TextWrapping="Wrap"/>
                </StackPanel>
              </Button>
            </WrapPanel>
          </StackPanel>
        </ScrollViewer>
      </Grid>

      <Popup x:Name="popBrowser" PlacementTarget="{Binding ElementName=btnHdrView}" Placement="Bottom"
             StaysOpen="False" AllowsTransparency="True">
        <Border Margin="10" Padding="16,14" CornerRadius="18" Background="#1C1C1E"
                BorderBrush="#26FFFFFF" BorderThickness="1">
          <Border.Effect>
            <DropShadowEffect BlurRadius="18" ShadowDepth="3" Opacity="0.25" Color="Black"/>
          </Border.Effect>
          <StackPanel Width="280">
            <TextBlock Text="PROJECT BROWSER PARAMETERS" Foreground="#8E8E93" FontSize="10.5" FontWeight="SemiBold" Margin="0,0,0,8"/>
            <TextBlock Foreground="#8E8E93" FontSize="11.5" TextWrapping="Wrap" Margin="0,0,0,8"
                       Text="View parameters by which Project Browser groups views (comma-separated). A new view takes their values from the neighboring view on the sheet. Empty - nothing is copied."/>
            <Grid>
              <TextBox x:Name="tbBrowserParams"/>
              <TextBlock x:Name="hBrowserParams" Text="e.g. FOLDER, LEVEL" Foreground="#8E8E93"
                         Margin="10,0,0,0" VerticalAlignment="Center" IsHitTestVisible="False"/>
            </Grid>
          </StackPanel>
        </Border>
      </Popup>

      <!-- ============ Print Sets ============ -->
      <Grid x:Name="pagePrint" Grid.Row="1" Grid.Column="1" Visibility="Collapsed">
      <!-- content -->
      <Grid Margin="22,0,22,14">
        <Grid.RowDefinitions>
          <RowDefinition Height="Auto"/>
          <RowDefinition Height="Auto"/>
          <RowDefinition Height="*"/>
          <RowDefinition Height="Auto"/>
          <RowDefinition Height="Auto"/>
          <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>

        <Grid Grid.Row="0" Margin="0,0,0,10">
          <Grid.ColumnDefinitions>
            <ColumnDefinition Width="*"/>
            <ColumnDefinition Width="Auto"/>
          </Grid.ColumnDefinitions>
          <StackPanel>
            <TextBlock x:Name="tbTitle" FontSize="24" FontWeight="Bold" Foreground="#F5F5F7"
                       TextTrimming="CharacterEllipsis"/>
            <TextBlock x:Name="tbSub" Foreground="#8E8E93" Margin="0,2,0,0"/>
          </StackPanel>
          <StackPanel Grid.Column="1" Orientation="Horizontal" VerticalAlignment="Top" Margin="8,0,-6,0">
            <Button x:Name="btnSelRevit" Style="{StaticResource IconBtn}" Content="&#xE7B3;"
                    ToolTip="Select this set's sheets in Revit"/>
            <Button x:Name="btnRevs" Style="{StaticResource IconBtn}" Content="&#xE8EC;"
                    ToolTip="Revisions: add / remove on the selected sheets (or on all if nothing is selected)"/>
            <Button x:Name="btnMakeSets" Style="{StaticResource IconBtn}" Content="&#xE71D;"
                    ToolTip="Create a separate Print Set in Revit for each group"/>
            <Border Width="1" Height="18" Background="#3A3A3C" Margin="6,0,8,0"/>
            <Button x:Name="btnDup" Style="{StaticResource IconBtn}" Content="&#xE8C8;" ToolTip="Duplicate set"/>
            <Button x:Name="btnRename" Style="{StaticResource IconBtn}" Content="&#xE8AC;" ToolTip="Rename set"/>
            <Button x:Name="btnDelete" Style="{StaticResource IconBtnDanger}" Content="&#xE74D;" ToolTip="Delete set"/>
          </StackPanel>
        </Grid>

        <Grid Grid.Row="1" Margin="0,0,0,8">
          <Grid.ColumnDefinitions>
            <ColumnDefinition Width="*"/>
            <ColumnDefinition Width="Auto"/>
          </Grid.ColumnDefinitions>
          <Grid>
            <TextBox x:Name="tbItemSearch"/>
            <TextBlock x:Name="hItemSearch" Text="Filter sheets in set…" Foreground="#8E8E93"
                       Margin="10,0,0,0" VerticalAlignment="Center" IsHitTestVisible="False"/>
          </Grid>
          <Button x:Name="btnSort" Grid.Column="1" Margin="8,0,0,0"
                  Style="{StaticResource Btn}" ToolTip="Click: next sort mode"/>
        </Grid>

        <Border Grid.Row="2" CornerRadius="16" BorderBrush="#2C2C2E" BorderThickness="1"
                Background="#1C1C1E" Padding="4">
          <ListBox x:Name="lstItems" SelectionMode="Extended" Background="Transparent"
                   BorderThickness="0" ScrollViewer.HorizontalScrollBarVisibility="Disabled"/>
        </Border>

        <Grid Grid.Row="3" Margin="0,12,0,0">
          <Grid.ColumnDefinitions>
            <ColumnDefinition Width="*"/>
            <ColumnDefinition Width="Auto"/>
          </Grid.ColumnDefinitions>

          <Border CornerRadius="17" Background="#1C1C1E" HorizontalAlignment="Left" VerticalAlignment="Center">
            <StackPanel Orientation="Horizontal">
              <Button x:Name="btnAdd" Style="{StaticResource SegBtn}"
                      ToolTip="Add the sheets selected in Revit to the set">
                <StackPanel Orientation="Horizontal">
                  <TextBlock Style="{StaticResource SegIcon}" Text="&#xE710;"/>
                  <TextBlock Text="Add"/>
                </StackPanel>
              </Button>
              <Border Width="1" Height="16" Background="#2C2C2E"/>
              <Button x:Name="btnReplace" Style="{StaticResource SegBtn}"
                      ToolTip="Replace the set contents with the sheets selected in Revit">
                <StackPanel Orientation="Horizontal">
                  <TextBlock Style="{StaticResource SegIcon}" Text="&#xE8AB;"/>
                  <TextBlock Text="Replace"/>
                </StackPanel>
              </Button>
              <Border Width="1" Height="16" Background="#2C2C2E"/>
              <Button x:Name="btnRemove" Style="{StaticResource SegBtn}"
                      ToolTip="Remove the sheets selected in the list from the set">
                <StackPanel Orientation="Horizontal">
                  <TextBlock Style="{StaticResource SegIcon}" Text="&#xE738;"/>
                  <TextBlock Text="Remove"/>
                </StackPanel>
              </Button>
            </StackPanel>
          </Border>

          <Border Grid.Column="1" CornerRadius="17" Background="#0071E3" VerticalAlignment="Center">
            <StackPanel Orientation="Horizontal">
              <Button x:Name="btnPrintOrd" Style="{StaticResource OnLimeBtnL}"
                      ToolTip="Print all groups one by one (group by group, as in Project Browser)">
                <StackPanel Orientation="Horizontal" Margin="14,0,12,0">
                  <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE749;"
                             FontSize="13" Margin="0,0,8,0" VerticalAlignment="Center"/>
                  <TextBlock x:Name="txtPrintOrd" Text="Print by groups" FontWeight="SemiBold" FontSize="13"
                             FontFamily="Segoe UI Variable Text, Segoe UI, Arial" VerticalAlignment="Center"/>
                </StackPanel>
              </Button>
              <Border Width="1" Height="18" Background="#40FFFFFF"/>
              <Button x:Name="btnPrintMore" Style="{StaticResource OnLimeBtnR}" Width="34"
                      FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" FontSize="11" Content="&#xE70D;"
                      ToolTip="Print settings"/>
            </StackPanel>
          </Border>

          <Popup x:Name="popPrint" PlacementTarget="{Binding ElementName=btnPrintMore}"
                 Placement="Top" HorizontalOffset="-260" StaysOpen="False" AllowsTransparency="True">
            <Border Margin="10" Padding="16,14" CornerRadius="18" Background="#1C1C1E"
                    BorderBrush="#26FFFFFF" BorderThickness="1">
              <Border.Effect>
                <DropShadowEffect BlurRadius="18" ShadowDepth="3" Opacity="0.25" Color="Black"/>
              </Border.Effect>
              <StackPanel Width="300">
                <TextBlock Text="PRINT SETTINGS" Foreground="#8E8E93" FontSize="10.5"
                           FontWeight="SemiBold" Margin="0,0,0,10"/>
                <TextBlock Text="Format" Foreground="#A1A1A6" FontSize="11.5" Margin="0,0,0,4"/>
                <ComboBox x:Name="cmbFmt" Margin="0,0,0,12" SelectedIndex="0">
                  <ComboBoxItem Content="PDF / printer"/>
                  <ComboBoxItem Content="DXF"/>
                  <ComboBoxItem Content="DWG"/>
                  <ComboBoxItem Content="DWF"/>
                  <ComboBoxItem Content="DWFx"/>
                  <ComboBoxItem Content="DGN"/>
                </ComboBox>
                <Grid x:Name="gridCombined" Margin="0,0,0,12">
                  <StackPanel VerticalAlignment="Center">
                    <TextBlock Text="One file per group"/>
                    <TextBlock Text="File name = group name" Foreground="#8E8E93" FontSize="11.5"/>
                  </StackPanel>
                  <CheckBox x:Name="chkCombined" Style="{StaticResource Switch}" IsChecked="True"
                            HorizontalAlignment="Right" VerticalAlignment="Center"/>
                </Grid>
                <Grid x:Name="gridNative" Margin="0,0,0,12">
                  <StackPanel VerticalAlignment="Center">
                    <TextBlock Text="Revit PDF export"/>
                    <TextBlock Text="Off - via printer" Foreground="#8E8E93" FontSize="11.5"/>
                  </StackPanel>
                  <CheckBox x:Name="chkNative" Style="{StaticResource Switch}" IsChecked="True"
                            HorizontalAlignment="Right" VerticalAlignment="Center"/>
                </Grid>
                <StackPanel x:Name="pnlCad" Visibility="Collapsed">
                  <StackPanel x:Name="pnlSetup" Margin="0,0,0,10">
                    <TextBlock Text="Revit export settings (layers, version, units)" Foreground="#A1A1A6" FontSize="11.5" Margin="0,0,0,4"/>
                    <ComboBox x:Name="cmbSetup"/>
                  </StackPanel>
                  <TextBlock Text="File name prefix" Foreground="#A1A1A6" FontSize="11.5" Margin="0,0,0,4"/>
                  <TextBox x:Name="tbPrefix" Margin="0,0,0,10"/>
                  <TextBlock Text="Name template" Foreground="#A1A1A6" FontSize="11.5" Margin="0,0,0,4"/>
                  <TextBox x:Name="tbTemplate" Margin="0,0,0,4"
                           ToolTip="Tokens: {prefix} {type} {number} {name} {group} {set} {idx}"/>
                  <TextBlock x:Name="txtNamePreview" Foreground="#0A84FF" FontSize="11" TextWrapping="Wrap" Margin="0,0,0,10"/>
                  <Grid Margin="0,0,0,10">
                    <TextBlock Text="Dots in the number to hyphens (03.0 - 03-0)" VerticalAlignment="Center" TextWrapping="Wrap" Margin="0,0,50,0"/>
                    <CheckBox x:Name="chkDots" Style="{StaticResource Switch}" IsChecked="True"
                              HorizontalAlignment="Right" VerticalAlignment="Center"/>
                  </Grid>
                  <Grid Margin="0,0,0,10">
                    <TextBlock Text="Subfolder for each group" VerticalAlignment="Center"/>
                    <CheckBox x:Name="chkSub" Style="{StaticResource Switch}"
                              HorizontalAlignment="Right" VerticalAlignment="Center"/>
                  </Grid>
                  <Grid x:Name="gridXref" Margin="0,0,0,12">
                    <TextBlock Text="Views on sheets as separate xrefs" VerticalAlignment="Center"/>
                    <CheckBox x:Name="chkXref" Style="{StaticResource Switch}"
                              HorizontalAlignment="Right" VerticalAlignment="Center"/>
                  </Grid>
                </StackPanel>
                <Border Height="1" Background="#2C2C2E" Margin="0,0,0,6"/>
                <Button x:Name="btnPrint" Style="{StaticResource BtnLink}" HorizontalContentAlignment="Left"
                        Content="Print via the Revit dialog…" Margin="-8,0,0,0"
                        ToolTip="Open the standard Print dialog with the selected set"/>
              </StackPanel>
            </Border>
          </Popup>
        </Grid>
        <TextBlock x:Name="txtStatus" Grid.Row="4" Foreground="#8E8E93" FontSize="12"
                   TextWrapping="Wrap" Margin="0,6,0,0" MinHeight="16"/>
      </Grid>
      </Grid>

      <!-- ============ Tools ============ -->
      <Grid x:Name="pageTools" Grid.Row="1" Grid.ColumnSpan="2" Visibility="Collapsed">
        <Grid.ColumnDefinitions>
          <ColumnDefinition Width="290"/>
          <ColumnDefinition Width="*"/>
        </Grid.ColumnDefinitions>

        <Border Grid.Column="0" Margin="22,4,0,20" CornerRadius="26" Background="#111113" Visibility="{Binding Visibility, ElementName=sideTools}"/>
        <Grid x:Name="sideTools" Grid.Column="0" Margin="44,26,22,42">
          <StackPanel>
            <TextBlock Style="{StaticResource Caption}" Text="SETTINGS"/>
            <TextBlock Text="Project Browser parameters" FontWeight="SemiBold" Foreground="#F5F5F7"/>
            <TextBlock Foreground="#8E8E93" FontSize="11.5" TextWrapping="Wrap" Margin="0,2,0,8"
                       Text="View parameters by which Project Browser groups views (comma-separated). A new view takes their values from the neighboring view on the sheet. Empty - nothing is copied."/>
          </StackPanel>
        </Grid>

        <Grid Grid.Column="1" Margin="22,0,22,14">
          <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
          </Grid.RowDefinitions>
          <StackPanel Grid.Row="0" Margin="0,0,0,10">
            <TextBlock FontSize="24" FontWeight="Bold" Foreground="#F5F5F7" Text="Tools"/>
            <TextBlock Foreground="#8E8E93" Margin="0,2,0,0" TextWrapping="Wrap"
                       Text="Elevation markers and quick creation of views on a sheet. Works with any project."/>
          </StackPanel>

          <ScrollViewer Grid.Row="1" VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled">
            <StackPanel Margin="0,0,6,0">
              <TextBlock Style="{StaticResource Caption}" Text="TOOLS"/>
              <Border CornerRadius="18" BorderBrush="#1F1F22" BorderThickness="1" Background="#111113">
                <StackPanel>
            <Button x:Name="btnMkSnap" Style="{StaticResource RowBtn}" ToolTip="Select markers on the plan. A deviation over 1° is considered intentional and is left alone">
              <Grid>
                <Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions>
                <Border Width="30" Height="30" CornerRadius="7" Background="#FF9F0A" VerticalAlignment="Center">
                  <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE7AD;" Foreground="White" FontSize="15" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                </Border>
                <StackPanel Grid.Column="1" Margin="12,0,8,0" VerticalAlignment="Center">
                  <TextBlock Text="Align Elevation markers"/>
                  <TextBlock Text="Bring the direction of the selected markers to a straight angle (90° step, no shift)" Foreground="#8E8E93" FontSize="11.5" TextWrapping="Wrap" Margin="0,1,0,0"/>
                </StackPanel>
                <TextBlock Grid.Column="2" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE76C;" Foreground="#5A5A5E" FontSize="11" VerticalAlignment="Center"/>
              </Grid>
            </Button>
            <Border Height="1" Background="#2C2C2E" Margin="54,0,0,0"/>
            <Button x:Name="btnMkMove" Style="{StaticResource RowBtn}" ToolTip="Select a marker (and/or view) on the plan, then pick the new place">
              <Grid>
                <Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions>
                <Border Width="30" Height="30" CornerRadius="7" Background="#5856D6" VerticalAlignment="Center">
                  <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE7C2;" Foreground="White" FontSize="15" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                </Border>
                <StackPanel Grid.Column="1" Margin="12,0,8,0" VerticalAlignment="Center">
                  <TextBlock Text="Move marker (view stays)"/>
                  <TextBlock Text="Panel with arrows: the marker moves, the view crop and blue line stay in place" Foreground="#8E8E93" FontSize="11.5" TextWrapping="Wrap" Margin="0,1,0,0"/>
                </StackPanel>
                <TextBlock Grid.Column="2" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE76C;" Foreground="#5A5A5E" FontSize="11" VerticalAlignment="Center"/>
              </Grid>
            </Button>
            <Border Height="1" Background="#2C2C2E" Margin="54,0,0,0"/>
            <Button x:Name="btnViewMake" Style="{StaticResource RowBtn}" ToolTip="Panel with three steps: selection, side, insert on the open sheet">
              <Grid>
                <Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions>
                <Border Width="30" Height="30" CornerRadius="7" Background="#30B0C7" VerticalAlignment="Center">
                  <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE722;" Foreground="White" FontSize="15" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                </Border>
                <StackPanel Grid.Column="1" Margin="12,0,8,0" VerticalAlignment="Center">
                  <TextBlock Text="View from Selection → Sheet"/>
                  <TextBlock Text="Remember elements and side, open a sheet, insert a ready Elevation/Section" Foreground="#8E8E93" FontSize="11.5" TextWrapping="Wrap" Margin="0,1,0,0"/>
                </StackPanel>
                <TextBlock Grid.Column="2" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE76C;" Foreground="#5A5A5E" FontSize="11" VerticalAlignment="Center"/>
              </Grid>
            </Button>
                </StackPanel>
              </Border>
            </StackPanel>
          </ScrollViewer>

          <TextBlock x:Name="tbToolsStatus" Grid.Row="2" Foreground="#8E8E93" FontSize="12"
                     TextWrapping="Wrap" Margin="0,8,0,0" MinHeight="16"/>
        </Grid>
      </Grid>

      <!-- ============ Annotations ============ -->
      <Grid x:Name="pageAnn" Grid.Row="1" Grid.ColumnSpan="2" Visibility="Collapsed">
        <Grid.ColumnDefinitions>
          <ColumnDefinition Width="290"/>
          <ColumnDefinition Width="*"/>
        </Grid.ColumnDefinitions>

        <Border Grid.Column="0" Margin="22,4,0,20" CornerRadius="26" Background="#111113" Visibility="{Binding Visibility, ElementName=sideAnn}"/>
        <Grid x:Name="sideAnn" Grid.Column="0" Margin="44,26,22,42">
          <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
          </Grid.RowDefinitions>
          <Grid Grid.Row="0" Margin="0,0,0,8">
            <TextBox x:Name="tbAnnSearch"/>
            <TextBlock x:Name="hAnnSearch" Text="Search annotations…" Foreground="#8E8E93"
                       Margin="10,0,0,0" VerticalAlignment="Center" IsHitTestVisible="False"/>
          </Grid>
          <ListBox x:Name="lstAnnNav" Grid.Row="1" Background="Transparent" BorderThickness="0"
                   ScrollViewer.HorizontalScrollBarVisibility="Disabled"/>
          <StackPanel Grid.Row="2" Margin="0,10,0,0">
            <!-- Save the selection as a set: the main new feature -->
            <Border x:Name="cardAnnSaveGroup" Visibility="Collapsed"
                    Background="#17407A" BorderBrush="#2F6FD1" BorderThickness="1"
                    CornerRadius="10" Padding="10" Margin="0,0,0,8">
              <StackPanel>
                <TextBlock x:Name="tbAnnSaveGroupHint" FontSize="11" FontWeight="SemiBold"
                           Foreground="#93C5FD" Margin="0,0,0,6" TextWrapping="Wrap"/>
                <Grid Margin="0,0,0,0">
                  <TextBox x:Name="tbAnnGroupName" MinHeight="30"/>
                  <TextBlock x:Name="hAnnGroupName" Text="Set name…" Foreground="#8E8E93"
                             Margin="10,0,0,0" VerticalAlignment="Center" IsHitTestVisible="False"/>
                </Grid>
                <Button x:Name="btnAnnSaveGroup" Style="{StaticResource BtnPrimary}"
                        Content="▶  Save as set" Margin="0,6,0,0"/>
              </StackPanel>
            </Border>
            <Button x:Name="btnAnnSetNew" Style="{StaticResource Btn}"
                    ToolTip="Create an empty annotation set">
              <StackPanel Orientation="Horizontal" HorizontalAlignment="Center">
                <TextBlock Style="{StaticResource SegIcon}" Text="&#xE710;"/>
                <TextBlock Text="New set"/>
              </StackPanel>
            </Button>
            <Border x:Name="cardAnnSet" Visibility="Collapsed" Background="#111113" BorderBrush="#1F1F22"
                    BorderThickness="1" CornerRadius="16" Padding="10" Margin="0,8,0,0">
              <StackPanel>
                <TextBlock x:Name="tbAnnSetTitle" Text="NEW SET" FontSize="11" FontWeight="SemiBold"
                           Foreground="#8E8E93" Margin="0,0,0,6"/>
                <TextBox x:Name="tbAnnSetName"/>
                <DockPanel Margin="0,8,0,0" LastChildFill="False">
                  <Button x:Name="btnAnnSetDelete" DockPanel.Dock="Right" Style="{StaticResource BtnDanger}" Content="Delete"/>
                  <Button x:Name="btnAnnSetSave" Style="{StaticResource BtnPrimary}" Content="Save"/>
                </DockPanel>
              </StackPanel>
            </Border>
          </StackPanel>
          <Button x:Name="btnAnnFromSel" Grid.Row="3" Style="{StaticResource Btn}" Margin="0,10,0,0"
                  ToolTip="Select placed annotations in the model and their types will go to favorites">
            <StackPanel Orientation="Horizontal" HorizontalAlignment="Center">
              <TextBlock Style="{StaticResource SegIcon}" Text="&#xE735;"/>
              <TextBlock Text="To favorites from selection"/>
            </StackPanel>
          </Button>
        </Grid>

        <Grid Grid.Column="1" Margin="22,0,22,14">
          <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
          </Grid.RowDefinitions>

          <Grid Grid.Row="0" Margin="0,0,0,12">
            <Grid.ColumnDefinitions>
              <ColumnDefinition Width="*"/>
              <ColumnDefinition Width="Auto"/>
            </Grid.ColumnDefinitions>
            <StackPanel VerticalAlignment="Center">
              <TextBlock Text="Annotations" FontSize="24" FontWeight="Bold" Foreground="#F5F5F7"/>
              <TextBlock x:Name="tbAnnSub" Foreground="#8E8E93" Margin="0,2,0,0" TextTrimming="CharacterEllipsis"/>
              <Border x:Name="cardAnnSel" Visibility="Collapsed" Background="#2A2210" BorderBrush="#5A4318" BorderThickness="1" CornerRadius="8" Padding="10,6,8,6" Margin="0,8,0,0">
                <DockPanel>
                  <StackPanel DockPanel.Dock="Right" Orientation="Horizontal">
                    <Button x:Name="btnAnnSaveGroupSel" Style="{StaticResource BtnPrimary}" Margin="6,0,0,0"
                            Content="&#x1F4E6; Save as group" ToolTip="Save all selected annotations as a group (Detail Group) for quick insertion as a kit"/>
                    <Button x:Name="btnAnnSelAdd" Style="{StaticResource Btn}" Margin="6,0,0,0"
                            Content="&#x2605; To favorites" ToolTip="Add the types of the annotations selected in Revit to favorites"/>
                  </StackPanel>
                  <TextBlock x:Name="tbAnnSelText" VerticalAlignment="Center" TextTrimming="CharacterEllipsis" Foreground="#FFD479" FontWeight="Medium"/>
                </DockPanel>
              </Border>
              <Border x:Name="cardAnnCreateGroup" Visibility="Collapsed" Background="#17407A" BorderBrush="#2F6FD1" BorderThickness="1" CornerRadius="8" Padding="10,8" Margin="0,6,0,0">
                <Grid>
                  <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="*"/>
                    <ColumnDefinition Width="Auto"/>
                    <ColumnDefinition Width="Auto"/>
                  </Grid.ColumnDefinitions>
                  <TextBox x:Name="tbAnnNewGroupName" VerticalAlignment="Center" MinHeight="30" Padding="8,4"/>
                  <Button x:Name="btnAnnDoSaveGroup" Grid.Column="1" Style="{StaticResource BtnPrimary}" Margin="8,0,0,0" Content="Save"/>
                  <Button x:Name="btnAnnCancelSaveGroup" Grid.Column="2" Style="{StaticResource IconBtn}" Margin="6,0,0,0" Content="&#xE711;" FontSize="12"/>
                </Grid>
              </Border>
              <Border x:Name="cardAnnMultiSel" Visibility="Collapsed" Background="#0F2A4D" CornerRadius="8" Padding="10,5,5,5" Margin="0,6,0,0">
                <DockPanel>
                  <StackPanel DockPanel.Dock="Right" Orientation="Horizontal">
                    <Button x:Name="btnAnnMSelSet" Style="{StaticResource Btn}" Margin="6,0,0,0"
                            Content="+ To set" ToolTip="Add all selected annotations to the active set"/>
                    <Button x:Name="btnAnnMSelFav" Style="{StaticResource Btn}" Margin="6,0,0,0"
                            Content="&#x2605; To favorites" ToolTip="Add all selected annotations to favorites"/>
                    <Button x:Name="btnAnnMSelClear" Style="{StaticResource IconBtn}" Margin="6,0,0,0"
                            Content="&#xE711;" FontSize="12"
                            ToolTip="Cancel the group selection"/>
                  </StackPanel>
                  <TextBlock x:Name="tbAnnMSelText" VerticalAlignment="Center" TextTrimming="CharacterEllipsis" Foreground="#60A5FA"/>
                </DockPanel>
              </Border>
            </StackPanel>
            <StackPanel Grid.Column="1" Orientation="Horizontal" VerticalAlignment="Top" Margin="12,0,0,0">
              <Button x:Name="btnAnnBar" Style="{StaticResource IconBtn}" Content="&#xE8A7;" Margin="0,0,8,0"
                      ToolTip="Toolbar: a thin horizontal strip with favorites (the main window stays in place)"/>
              <TextBlock Text="Source:" Foreground="#A1A1A6" VerticalAlignment="Center" Margin="0,0,8,0"/>
              <ComboBox x:Name="cbAnnSrc" MinWidth="230"
                        ToolTip="Which categories to load from the model type list. Favorites are always shown."/>
            </StackPanel>
          </Grid>

          <Grid Grid.Row="1">
            <ScrollViewer x:Name="svAnn" VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled">
              <StackPanel x:Name="pnlAnnGroups" Margin="0,0,8,0"/>
            </ScrollViewer>
            <TextBlock x:Name="tbAnnEmpty" Foreground="#8E8E93" TextWrapping="Wrap" TextAlignment="Center"
                       Margin="30,0" VerticalAlignment="Center" IsHitTestVisible="False"/>
          </Grid>

          <Border x:Name="cardAnnEdit" Grid.Row="2" Visibility="Collapsed" Background="#111113" BorderBrush="#1F1F22"
                  BorderThickness="1" CornerRadius="16" Padding="16,12,16,12" Margin="0,10,0,0">
            <StackPanel>
              <TextBlock x:Name="tbAnnEditName" FontSize="15" FontWeight="Bold" Foreground="#F5F5F7" TextTrimming="CharacterEllipsis"/>
              <TextBlock x:Name="tbAnnEditFam" Foreground="#8E8E93" FontSize="12" Margin="0,1,0,8" TextTrimming="CharacterEllipsis"/>
              <TextBlock Text="WHAT I USE THIS FOR" Foreground="#8E8E93" FontSize="11.5" FontWeight="SemiBold" Margin="0,0,0,6"/>
              <Grid>
                <TextBox x:Name="tbAnnNote" AcceptsReturn="True" TextWrapping="Wrap" MinHeight="58" MaxHeight="110"
                         VerticalScrollBarVisibility="Auto" VerticalContentAlignment="Top"/>
                <TextBlock x:Name="hAnnNote" Text="When to place it, what it means, on which views / sheets…" Foreground="#8E8E93"
                           Margin="10,8,0,0" VerticalAlignment="Top" IsHitTestVisible="False"/>
              </Grid>
              <TextBlock Text="SETS FOR THE PANEL" Foreground="#8E8E93" FontSize="11.5" FontWeight="SemiBold" Margin="0,12,0,6"/>
              <WrapPanel x:Name="pnlAnnEditSets"/>
              <DockPanel Margin="0,4,0,0" LastChildFill="False">
                <TextBlock Text="Category:" Foreground="#A1A1A6" VerticalAlignment="Center" Margin="0,0,8,0"/>
                <ComboBox x:Name="cbAnnCat" IsEditable="True" MinWidth="220"
                          ToolTip="Pick an existing category or type a new one"/>
                <Button x:Name="btnAnnEditClose" DockPanel.Dock="Right" Style="{StaticResource BtnLink}" Content="Close" Margin="8,0,0,0"/>
                <Button x:Name="btnAnnEditSave" DockPanel.Dock="Right" Style="{StaticResource BtnPrimary}" Content="Save" Margin="8,0,0,0"/>
                <Button x:Name="btnAnnEditWasd" DockPanel.Dock="Right" Style="{StaticResource Btn}" Content="WASD: no" Margin="8,0,0,0"
                        ToolTip="Place this annotation in WASD mode (to geometry). Caps Lock off - standard"/>
                <Button x:Name="btnAnnEditFav" DockPanel.Dock="Right" Style="{StaticResource Btn}" Content="To favorites"/>
              </DockPanel>
            </StackPanel>
          </Border>

          <TextBlock x:Name="txtAnnStatus" Grid.Row="3" Foreground="#8E8E93" FontSize="12" TextWrapping="Wrap"
                     VerticalAlignment="Center" MinHeight="16" Margin="0,10,0,0"/>
        </Grid>
      </Grid>

      <!-- ============ Modules ============ -->
      <Grid x:Name="pageMod" Grid.Row="1" Grid.ColumnSpan="2" Margin="22,4,22,20" Visibility="Collapsed">
        <Grid.ColumnDefinitions>
          <ColumnDefinition Width="290"/>
          <ColumnDefinition Width="*"/>
        </Grid.ColumnDefinitions>

        <Border Grid.Column="0" Margin="0,0,22,0" CornerRadius="26" Background="#111113" Padding="22">
          <Grid>
            <Grid.RowDefinitions>
              <RowDefinition Height="Auto"/>
              <RowDefinition Height="Auto"/>
              <RowDefinition Height="Auto"/>
              <RowDefinition Height="*"/>
              <RowDefinition Height="Auto"/>
            </Grid.RowDefinitions>
            <StackPanel Grid.Row="0">
              <TextBlock Style="{StaticResource Caption}" Margin="0,0,0,6" Text="MODULES"/>
              <TextBlock FontSize="22" FontWeight="Bold" TextWrapping="Wrap" Text="Custom scripts"/>
              <TextBlock Foreground="#8E8E93" FontSize="11.5" TextWrapping="Wrap" Margin="0,6,0,0"
                         Text="Python files that run straight from Toolkit in the current project."/>
            </StackPanel>
            <Border Grid.Row="1" Margin="0,18,0,0" CornerRadius="18" Background="#1C1C1E" Padding="14,12">
              <StackPanel>
                <TextBlock x:Name="tbModCount" FontSize="30" FontWeight="Bold" Foreground="#2997FF" Text="0"/>
                <TextBlock Foreground="#8E8E93" FontSize="11.5" Text="modules in the folder"/>
              </StackPanel>
            </Border>
            <StackPanel x:Name="pnlModBar" Grid.Row="2" Margin="0,16,0,0"/>
            <TextBlock x:Name="tbModHint" Grid.Row="3" VerticalAlignment="Bottom" Foreground="#8E8E93" FontSize="10.5"
                       TextWrapping="Wrap" Margin="2,12,0,0"/>
            <TextBlock x:Name="tbModStatus" Grid.Row="4" Foreground="#8E8E93" FontSize="12" TextWrapping="Wrap"
                       MinHeight="16" Margin="0,10,0,0"/>
          </Grid>
        </Border>

        <ScrollViewer Grid.Column="1" VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled">
          <StackPanel x:Name="pnlMods" Margin="0,0,6,0"/>
        </ScrollViewer>
      </Grid>

      <!-- ============ Tile Params ============ -->
      <Grid x:Name="pageTile" Grid.Row="1" Grid.Column="0" Grid.ColumnSpan="2" Margin="22,0,22,14" Visibility="Collapsed">
        <Grid.RowDefinitions>
          <RowDefinition Height="Auto"/>
          <RowDefinition Height="*"/>
          <RowDefinition Height="Auto"/>
          <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>

        <Grid Grid.Row="0" Margin="0,0,0,12">
          <Grid.ColumnDefinitions>
            <ColumnDefinition Width="*"/>
            <ColumnDefinition Width="Auto"/>
          </Grid.ColumnDefinitions>
          <StackPanel VerticalAlignment="Center">
            <TextBlock Text="Params" FontSize="24" FontWeight="Bold" Foreground="#F5F5F7"/>
            <TextBlock x:Name="tbTSub" Foreground="#8E8E93" Margin="0,2,0,0" TextTrimming="CharacterEllipsis"/>
          </StackPanel>
          <StackPanel Grid.Column="1" Orientation="Horizontal" VerticalAlignment="Top" Margin="12,0,0,0">
            <Border Background="#1C1C1E" CornerRadius="17" Margin="0,0,8,0">
              <StackPanel Orientation="Horizontal">
                <Button x:Name="btnTCols" Style="{StaticResource SegBtn}" ToolTip="Choose which parameters to show in the table (remembered per project)">
                  <StackPanel Orientation="Horizontal"><TextBlock Style="{StaticResource SegIcon}" Text="&#xE8FD;"/><TextBlock Text="Columns"/></StackPanel>
                </Button>
                <Border Width="1" Height="16" Background="#2C2C2E"/>
                <Button x:Name="btnTBulk" Style="{StaticResource SegBtn}" ToolTip="Bulk edit panel for the selected rows">
                  <StackPanel Orientation="Horizontal"><TextBlock Style="{StaticResource SegIcon}" Text="&#xE70F;"/><TextBlock Text="Bulk edit"/></StackPanel>
                </Button>
                <Border Width="1" Height="16" Background="#2C2C2E"/>
                <Button x:Name="btnTSelect" Style="{StaticResource SegBtn}" ToolTip="Select the elements of the chosen rows in the model">
                  <StackPanel Orientation="Horizontal"><TextBlock Style="{StaticResource SegIcon}" Text="&#xE7B3;"/><TextBlock Text="In model"/></StackPanel>
                </Button>
                <Border Width="1" Height="16" Background="#2C2C2E"/>
                <Button x:Name="btnTClear" Style="{StaticResource SegBtn}" ToolTip="Clear the table">
                  <StackPanel Orientation="Horizontal"><TextBlock Style="{StaticResource SegIcon}" Text="&#xE711;"/><TextBlock Text="Clear"/></StackPanel>
                </Button>
              </StackPanel>
            </Border>
            <Button x:Name="btnTUpdate" Style="{StaticResource BtnPrimary}"
                    ToolTip="Read the parameters of the elements selected in Revit">
              <StackPanel Orientation="Horizontal">
                <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE72C;" Margin="0,0,8,0" VerticalAlignment="Center"/>
                <TextBlock Text="Refresh from selection" VerticalAlignment="Center"/>
              </StackPanel>
            </Button>
          </StackPanel>
        </Grid>

        <Border Grid.Row="1" Background="#111113" BorderBrush="#1F1F22" BorderThickness="1" CornerRadius="18">
          <Grid>
            <DataGrid x:Name="gridT" AutoGenerateColumns="False" CanUserAddRows="False" CanUserDeleteRows="False"
                      CanUserResizeRows="False" SelectionMode="Extended" SelectionUnit="FullRow"
                      GridLinesVisibility="Horizontal" HorizontalGridLinesBrush="#222225"
                      HeadersVisibility="Column" BorderThickness="0" Background="Transparent"
                      RowBackground="Transparent" RowHeight="36" ColumnHeaderHeight="34" Margin="6"
                      FontSize="13" Foreground="#F5F5F7">
              <DataGrid.Resources>
                <SolidColorBrush x:Key="{x:Static SystemColors.HighlightBrushKey}" Color="#0F2A4D"/>
                <SolidColorBrush x:Key="{x:Static SystemColors.InactiveSelectionHighlightBrushKey}" Color="#0F2A4D"/>
                <SolidColorBrush x:Key="{x:Static SystemColors.HighlightTextBrushKey}" Color="#F5F5F7"/>
                <SolidColorBrush x:Key="{x:Static SystemColors.InactiveSelectionHighlightTextBrushKey}" Color="#F5F5F7"/>
              </DataGrid.Resources>
              <DataGrid.ColumnHeaderStyle>
                <Style TargetType="DataGridColumnHeader">
                  <Setter Property="Background" Value="Transparent"/>
                  <Setter Property="Foreground" Value="#8E8E93"/>
                  <Setter Property="FontSize" Value="11.5"/>
                  <Setter Property="FontWeight" Value="SemiBold"/>
                  <Setter Property="Padding" Value="10,0"/>
                  <Setter Property="BorderBrush" Value="#2C2C2E"/>
                  <Setter Property="BorderThickness" Value="0,0,0,1"/>
                  <Setter Property="Template">
                    <Setter.Value>
                      <ControlTemplate TargetType="DataGridColumnHeader">
                        <Border Background="{TemplateBinding Background}" BorderBrush="{TemplateBinding BorderBrush}"
                                BorderThickness="{TemplateBinding BorderThickness}" Padding="{TemplateBinding Padding}">
                          <ContentPresenter VerticalAlignment="Center"/>
                        </Border>
                      </ControlTemplate>
                    </Setter.Value>
                  </Setter>
                </Style>
              </DataGrid.ColumnHeaderStyle>
              <DataGrid.CellStyle>
                <Style TargetType="DataGridCell">
                  <Setter Property="BorderThickness" Value="0"/>
                  <Setter Property="Padding" Value="10,0"/>
                  <Setter Property="FocusVisualStyle" Value="{x:Null}"/>
                  <Setter Property="Template">
                    <Setter.Value>
                      <ControlTemplate TargetType="DataGridCell">
                        <Border Background="{TemplateBinding Background}" Padding="{TemplateBinding Padding}">
                          <ContentPresenter VerticalAlignment="Center"/>
                        </Border>
                      </ControlTemplate>
                    </Setter.Value>
                  </Setter>
                  <Style.Triggers>
                    <Trigger Property="IsSelected" Value="True">
                      <Setter Property="Background" Value="#0F2A4D"/>
                      <Setter Property="Foreground" Value="#F5F5F7"/>
                    </Trigger>
                  </Style.Triggers>
                </Style>
              </DataGrid.CellStyle>
            </DataGrid>
            <StackPanel x:Name="pnlTEmpty" HorizontalAlignment="Center" VerticalAlignment="Center" MaxWidth="380" IsHitTestVisible="False">
              <Border Width="52" Height="52" CornerRadius="13" Background="#0F2A4D" HorizontalAlignment="Center">
                <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE80A;" Foreground="#0A84FF"
                           FontSize="26" HorizontalAlignment="Center" VerticalAlignment="Center"/>
              </Border>
              <TextBlock x:Name="tbTEmptyText" Foreground="#8E8E93" TextAlignment="Center" TextWrapping="Wrap" Margin="0,12,0,0"/>
            </StackPanel>
          </Grid>
        </Border>

        <Border x:Name="cardBulk" Grid.Row="2" Visibility="Collapsed" Margin="0,12,0,0" Background="#111113"
                BorderBrush="#1F1F22" BorderThickness="1" CornerRadius="22" Padding="16,12">
          <DockPanel>
            <Grid DockPanel.Dock="Top" Margin="0,0,0,8">
              <Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions>
              <StackPanel VerticalAlignment="Center">
                <TextBlock Text="Bulk edit of the selected rows" FontWeight="SemiBold" FontSize="14"/>
                <TextBlock Text="Turn on the needed parameters and enter values (an empty field is written too). If nothing is selected — all rows."
                           Foreground="#8E8E93" FontSize="11.5" TextWrapping="Wrap" Margin="0,2,12,0"/>
              </StackPanel>
              <Button x:Name="btnTBulkApply" Grid.Column="1" Style="{StaticResource BtnPrimary}" Content="Apply to selected"/>
            </Grid>
            <ScrollViewer MaxHeight="170" VerticalScrollBarVisibility="Auto">
              <StackPanel x:Name="pnlBulkRows"/>
            </ScrollViewer>
          </DockPanel>
        </Border>

        <Grid Grid.Row="3" Margin="0,10,0,0">
          <Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions>
          <TextBlock x:Name="txtTStatus" Foreground="#8E8E93" FontSize="12" TextWrapping="Wrap"
                     VerticalAlignment="Center" MinHeight="16"/>
          <Button x:Name="btnTApply" Grid.Column="1" Style="{StaticResource BtnPrimary}" Content="Apply changes from the table"
                  ToolTip="Write the changed cells to the model elements"/>
        </Grid>
      </Grid>

      <!-- ============ View Naming ============ -->
      <Grid x:Name="pageNm" Grid.Row="1" Grid.Column="1" Visibility="Collapsed">
        <Grid Margin="22,0,22,14">
          <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
          </Grid.RowDefinitions>

          <Grid Grid.Row="0" Margin="0,0,0,12">
            <Grid.ColumnDefinitions>
              <ColumnDefinition Width="*"/>
              <ColumnDefinition Width="Auto"/>
            </Grid.ColumnDefinitions>
            <StackPanel VerticalAlignment="Center">
              <TextBlock x:Name="tbNmTitle" Text="View naming" FontSize="24" FontWeight="Bold"
                         Foreground="#F5F5F7" TextTrimming="CharacterEllipsis"/>
              <TextBlock x:Name="tbNmSub" Foreground="#8E8E93" Margin="0,2,0,0" TextTrimming="CharacterEllipsis"/>
            </StackPanel>
            <Button x:Name="btnNmApply" Grid.Column="1" Style="{StaticResource BtnPrimary}" Content="Apply"
                    VerticalAlignment="Center" Margin="12,0,0,0"
                    ToolTip="Write the keywords to the view parameters and rename the views of this set"/>
          </Grid>

          <Border Grid.Row="1" Background="#111113" BorderBrush="#1F1F22" BorderThickness="1" CornerRadius="22"
                  Padding="18,14,18,6" Margin="0,0,0,12">
            <StackPanel>
              <Grid>
                <Grid.ColumnDefinitions>
                  <ColumnDefinition Width="*"/>
                  <ColumnDefinition Width="Auto"/>
                </Grid.ColumnDefinitions>
                <StackPanel>
                  <TextBlock Text="SETTINGS FOR" Foreground="#8E8E93" FontSize="11.5" FontWeight="SemiBold"/>
                  <TextBlock x:Name="tbNmScope" FontSize="16" FontWeight="SemiBold" Foreground="#F5F5F7"
                             Margin="0,3,0,0" TextTrimming="CharacterEllipsis"/>
                  <TextBlock x:Name="tbNmScopeSub" Foreground="#8E8E93" FontSize="12" Margin="0,1,0,0"
                             TextTrimming="CharacterEllipsis"/>
                </StackPanel>
                <Button x:Name="btnNmResetScope" Grid.Column="1" Style="{StaticResource BtnLink}"
                        Content="Reset for this scope" VerticalAlignment="Top" Visibility="Collapsed"
                        ToolTip="Remove this scope's own values and template: it will inherit from the higher one again"/>
              </Grid>

              <Border Height="1" Background="#222225" Margin="0,12,0,12"/>

              <Grid>
                <Grid.ColumnDefinitions>
                  <ColumnDefinition Width="*"/>
                  <ColumnDefinition Width="Auto"/>
                </Grid.ColumnDefinitions>
                <TextBlock Text="KEYWORDS  ·  VIEW PARAMETERS" Foreground="#8E8E93" FontSize="11.5" FontWeight="SemiBold"
                           VerticalAlignment="Center"/>
                <Button x:Name="btnNmAddKw" Grid.Column="1" Style="{StaticResource BtnLink}" Content="+ Word"
                        ToolTip="Add a view parameter to the project keywords"/>
              </Grid>
              <WrapPanel x:Name="pnlNmKw" Margin="0,8,0,0"/>
              <TextBlock x:Name="tbNmKwEmpty" Foreground="#8E8E93" TextWrapping="Wrap" Margin="0,4,0,8"
                         Text="Add keywords: view parameters that get filled in and go into the name."/>

              <TextBlock Text="VIEW NAME TEMPLATE" Foreground="#8E8E93" FontSize="11.5" FontWeight="SemiBold" Margin="0,2,0,0"/>
              <Grid Margin="0,8,0,0">
                <TextBox x:Name="tbNmTemplate"
                         ToolTip="Words in curly braces are replaced with values. Click a word below to insert it."/>
                <TextBlock x:Name="hNmTemplate" Foreground="#8E8E93" Margin="10,0,0,0" VerticalAlignment="Center"
                           IsHitTestVisible="False"/>
              </Grid>
              <WrapPanel x:Name="pnlNmChips" Margin="0,10,0,0"/>
              <StackPanel Orientation="Horizontal" Margin="0,2,0,8">
                <TextBlock Text="What {VIEW} means" Foreground="#A1A1A6" VerticalAlignment="Center"/>
                <ComboBox x:Name="cbNmBase" MinWidth="300" Margin="12,0,0,0"/>
              </StackPanel>
            </StackPanel>
          </Border>

          <Border Grid.Row="2" Background="#111113" BorderBrush="#1F1F22" BorderThickness="1" CornerRadius="18" MinHeight="150">
            <Grid>
              <ScrollViewer x:Name="svNmList" VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled" Margin="8,6,8,8">
                <StackPanel x:Name="pnlNmList" Margin="0,0,6,6"/>
              </ScrollViewer>
              <StackPanel x:Name="pnlNmEmpty" HorizontalAlignment="Center" VerticalAlignment="Center" MaxWidth="420" IsHitTestVisible="False">
                <Border Width="52" Height="52" CornerRadius="13" Background="#0F2A4D" HorizontalAlignment="Center">
                  <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE8A5;" Foreground="#0A84FF"
                             FontSize="26" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                </Border>
                <TextBlock x:Name="tbNmEmptyText" Foreground="#8E8E93" TextAlignment="Center" TextWrapping="Wrap" Margin="0,12,0,0"/>
              </StackPanel>
            </Grid>
          </Border>

          <TextBlock x:Name="txtNStatus" Grid.Row="3" Foreground="#8E8E93" FontSize="12" TextWrapping="Wrap"
                     VerticalAlignment="Center" MinHeight="16" Margin="0,10,0,0"/>
        </Grid>
      </Grid>
      <!-- ============ /pages ============ -->
        </Grid>
      </Grid>
    </Border>
    </Grid>
    </Border>
  </Grid>
</Window>
"""


ASK_XAML = u"""
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Width="460" SizeToContent="Height" ResizeMode="NoResize" Topmost="True"
        ShowInTaskbar="False" WindowStartupLocation="CenterOwner"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        FontFamily="Segoe UI Variable Text, Segoe UI, Arial" FontSize="13">
  <Window.Resources>@THEME@</Window.Resources>
  <Border Margin="16" CornerRadius="12" Background="#F5F5F7" BorderBrush="#26000000" BorderThickness="1">
    <Border.Effect><DropShadowEffect BlurRadius="24" ShadowDepth="4" Opacity="0.28" Color="Black"/></Border.Effect>
    <StackPanel>
      <Grid x:Name="dragBar" Height="46" Background="Transparent">
        <TextBlock x:Name="tbTitle" HorizontalAlignment="Center" VerticalAlignment="Center"
                   FontWeight="SemiBold" Foreground="#1C1C1E" IsHitTestVisible="False"/>
        <Border x:Name="btnClose" Width="13" Height="13" CornerRadius="7" Background="#FF5F57"
                HorizontalAlignment="Left" Margin="16,0,0,0" Cursor="Hand" ToolTip="Close"/>
      </Grid>
      <StackPanel Margin="22,2,22,0">
        <TextBlock x:Name="tbPrompt" Foreground="#6E6E73" TextWrapping="Wrap" Margin="0,0,0,8"/>
        <TextBox x:Name="tbValue" Padding="10,7" MinHeight="34"/>
      </StackPanel>
      <Border BorderBrush="#E5E5EA" BorderThickness="0,1,0,0" Margin="0,20,0,0" Padding="22,12" CornerRadius="0,0,12,12">
        <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
          <Button x:Name="btnCancel" Content="Cancel" IsCancel="True" Padding="16,6" Margin="0,0,8,0"/>
          <Button x:Name="btnOk" Content="OK" IsDefault="True" Padding="24,6"/>
        </StackPanel>
      </Border>
    </StackPanel>
  </Border>
</Window>
"""


CONFIRM_XAML = u"""
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Width="460" SizeToContent="Height" ResizeMode="NoResize" Topmost="True"
        ShowInTaskbar="False" WindowStartupLocation="CenterOwner"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        FontFamily="Segoe UI Variable Text, Segoe UI, Arial" FontSize="13">
  <Window.Resources>@THEME@</Window.Resources>
  <Border Margin="16" CornerRadius="12" Background="#F5F5F7" BorderBrush="#26000000" BorderThickness="1">
    <Border.Effect><DropShadowEffect BlurRadius="24" ShadowDepth="4" Opacity="0.28" Color="Black"/></Border.Effect>
    <StackPanel>
      <Grid x:Name="dragBar" Height="46" Background="Transparent">
        <TextBlock x:Name="tbTitle" HorizontalAlignment="Center" VerticalAlignment="Center"
                   FontWeight="SemiBold" Foreground="#1C1C1E" IsHitTestVisible="False"/>
        <Border x:Name="btnClose" Width="13" Height="13" CornerRadius="7" Background="#FF5F57"
                HorizontalAlignment="Left" Margin="16,0,0,0" Cursor="Hand" ToolTip="Close"/>
      </Grid>
      <TextBlock x:Name="tbText" Margin="22,2,22,0" TextWrapping="Wrap" Foreground="#3A3A3C"/>
      <Border BorderBrush="#E5E5EA" BorderThickness="0,1,0,0" Margin="0,20,0,0" Padding="22,12" CornerRadius="0,0,12,12">
        <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
          <Button x:Name="btnNo" Content="No" IsCancel="True" Padding="18,6" Margin="0,0,8,0"/>
          <Button x:Name="btnYes" Content="Yes" IsDefault="True" Padding="22,6"/>
        </StackPanel>
      </Border>
    </StackPanel>
  </Border>
</Window>
"""


REV_XAML = u"""
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Revisions" Width="820" Height="660" MinWidth="660" MinHeight="460" Topmost="True"
        ShowInTaskbar="False" WindowStartupLocation="CenterOwner" ResizeMode="CanResizeWithGrip"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        FontFamily="Segoe UI Variable Text, Segoe UI, Arial" FontSize="13">
  <Window.Resources>@THEME@</Window.Resources>
  <Border Margin="16" CornerRadius="12" Background="#F5F5F7" BorderBrush="#26000000" BorderThickness="1">
    <Border.Effect><DropShadowEffect BlurRadius="24" ShadowDepth="4" Opacity="0.28" Color="Black"/></Border.Effect>
    <Grid>
      <Grid.RowDefinitions>
        <RowDefinition Height="46"/><RowDefinition Height="*"/><RowDefinition Height="Auto"/>
      </Grid.RowDefinitions>
      <Grid x:Name="dragBar" Background="Transparent">
        <TextBlock Text="Revisions" HorizontalAlignment="Center" VerticalAlignment="Center"
                   FontWeight="SemiBold" Foreground="#1C1C1E" IsHitTestVisible="False"/>
        <Border x:Name="btnClose" Width="13" Height="13" CornerRadius="7" Background="#FF5F57"
                HorizontalAlignment="Left" Margin="16,0,0,0" Cursor="Hand" ToolTip="Close"/>
      </Grid>
      <Grid Grid.Row="1" Margin="22,2,22,14">
        <Grid.RowDefinitions>
          <RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="*"/>
        </Grid.RowDefinitions>
        <TextBlock x:Name="tbInfo" FontSize="20" FontWeight="Bold" Foreground="#1C1C1E" TextWrapping="Wrap"/>
        <TextBlock x:Name="tbHelp" Grid.Row="1" Foreground="#8E8E93" TextWrapping="Wrap" Margin="0,4,0,12"/>
        <Grid Grid.Row="2" Margin="0,0,0,10">
          <TextBox x:Name="tbFilter" Padding="32,7,10,7" MinHeight="34"
                   ToolTip="Filter: number, date, issued by, description"/>
          <TextBlock Text="&#xE721;" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Foreground="#8E8E93"
                     HorizontalAlignment="Left" VerticalAlignment="Center" Margin="11,0,0,0" IsHitTestVisible="False"/>
        </Grid>
        <Border Grid.Row="3" Background="White" BorderBrush="#E5E5EA" BorderThickness="1" CornerRadius="12">
          <ScrollViewer VerticalScrollBarVisibility="Auto" Margin="6">
            <StackPanel x:Name="pnl"/>
          </ScrollViewer>
        </Border>
      </Grid>
      <Border Grid.Row="2" BorderBrush="#E5E5EA" BorderThickness="0,1,0,0" Padding="22,12" CornerRadius="0,0,12,12">
        <DockPanel>
          <StackPanel DockPanel.Dock="Left" Orientation="Horizontal">
            <Button x:Name="btnNone" Content="Remove all" Padding="14,6" Margin="0,0,8,0"/>
            <Button x:Name="btnReset" Content="Reset" Padding="14,6"/>
          </StackPanel>
          <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
            <Button x:Name="btnCancel" Content="Cancel" IsCancel="True" Padding="16,6" Margin="0,0,8,0"/>
            <Button x:Name="btnOk" Content="Apply" IsDefault="True" Padding="22,6"/>
          </StackPanel>
        </DockPanel>
      </Border>
    </Grid>
  </Border>
</Window>
"""


def wire_chrome(dlg):
    """Dragging by the title and a red close button for windows with their own chrome."""
    bar = dlg.FindName("dragBar")
    close = dlg.FindName("btnClose")
    if bar is not None:
        def drag(s, e):
            try:
                dlg.DragMove()
            except Exception:
                pass
        bar.MouseLeftButtonDown += drag
    if close is not None:
        def down(s, e):
            e.Handled = True

        def up(s, e):
            dlg.Close()
        close.MouseLeftButtonDown += down
        close.MouseLeftButtonUp += up


def ask_revisions(owner, info, revs, states):
    """revs - list of dicts (already sorted), states - {id: True/False/None}.
    Returns {id: True/False} only for changed revisions, or None on cancel."""
    dlg = load_xaml(REV_XAML)
    dlg.Owner = owner
    wire_chrome(dlg)
    dlg.FindName("tbInfo").Text = info
    dlg.FindName("tbHelp").Text = (u"Checkmark - add to all sheets; empty - remove from all; "
                                   u"square - differs across sheets (unchanged until clicked).")
    pnl = dlg.FindName("pnl")
    tbf = dlg.FindName("tbFilter")
    rows = []          # (rev, checkbox, searchtext)

    def cell(text, w, fg=None):
        t = TextBlock()
        t.Text = text
        t.Width = w
        t.TextTrimming = TextTrimming.CharacterEllipsis
        if fg is not None:
            t.Foreground = fg
        return t

    for r in revs:
        cb = CheckBox()
        init = states.get(r["id"])
        cb.IsThreeState = init is None
        cb.IsChecked = init
        cb.Margin = Thickness(2, 3, 2, 3)
        sp = StackPanel()
        sp.Orientation = Orientation.Horizontal
        gray = GRAY if r["issued"] else None
        sp.Children.Add(cell(u"#" + unicode(r["seq"]), 40, GRAY))
        sp.Children.Add(cell(r["num"], 44, gray))
        sp.Children.Add(cell(r["date"], 84, gray))
        sp.Children.Add(cell(r["by"], 140, gray))
        sp.Children.Add(cell(r["to"], 50, gray))
        sp.Children.Add(cell(r["desc"] + (u"  (issued)" if r["issued"] else u""), 300, gray))
        cb.Content = sp
        pnl.Children.Add(cb)
        rows.append((r, cb, u" ".join([unicode(r["seq"]), r["num"], r["date"], r["by"], r["to"], r["desc"]]).lower()))

    def refilter(s=None, e=None):
        q = (tbf.Text or u"").strip().lower()
        for r, cb, txt in rows:
            cb.Visibility = Visibility.Visible if (not q or q in txt) else Visibility.Collapsed

    def set_all(val):
        for r, cb, txt in rows:
            cb.IsThreeState = False
            cb.IsChecked = val

    def reset(s=None, e=None):
        for r, cb, txt in rows:
            init = states.get(r["id"])
            cb.IsThreeState = init is None
            cb.IsChecked = init

    tbf.TextChanged += refilter
    dlg.FindName("btnNone").Click += lambda s, e: set_all(False)
    dlg.FindName("btnReset").Click += reset

    def ok(s, e):
        dlg.DialogResult = True

    dlg.FindName("btnOk").Click += ok
    if not dlg.ShowDialog():
        return None
    changes = {}
    for r, cb, txt in rows:
        v = cb.IsChecked
        if v is None:
            continue
        if v != states.get(r["id"]):
            changes[r["id"]] = bool(v)
    return changes


def ask_string(owner, title, prompt, default=u""):
    dlg = load_xaml(ASK_XAML)
    dlg.Title = title
    dlg.Owner = owner
    dlg.FindName("tbTitle").Text = title
    dlg.FindName("tbPrompt").Text = prompt
    wire_chrome(dlg)
    tb = dlg.FindName("tbValue")
    tb.Text = default

    def ok(s, e):
        dlg.DialogResult = True

    def loaded(s, e):
        tb.Focus()
        tb.SelectAll()

    dlg.FindName("btnOk").Click += ok
    dlg.Loaded += loaded
    if dlg.ShowDialog():
        return tb.Text
    return None


def confirm(owner, text, title=u"Universal Toolkit"):
    dlg = load_xaml(CONFIRM_XAML)
    dlg.Owner = owner
    dlg.Title = title
    dlg.FindName("tbTitle").Text = title
    dlg.FindName("tbText").Text = text
    wire_chrome(dlg)
    yes, no = dlg.FindName("btnYes"), dlg.FindName("btnNo")
    if text.strip().lower().startswith(u"delete"):
        # Dangerous action: a red button, and Enter cancels by default.
        yes.Content, no.Content = u"Delete", u"Cancel"
        yes.Background = BrushConverter().ConvertFromString("#FF3B30")
        yes.Foreground = BrushConverter().ConvertFromString("#FFFFFF")
        yes.IsDefault, no.IsDefault = False, True
    else:
        yes.Foreground = BrushConverter().ConvertFromString("#FFFFFF")
        yes.Background = BrushConverter().ConvertFromString("#007AFF")

    def ok(s, e):
        dlg.DialogResult = True

    yes.Click += ok
    return bool(dlg.ShowDialog())


SORT_MODES = [("browser", u"As in Project Browser"),
              ("number", u"By number"),
              ("name", u"By name"),
              ("added", u"By order of addition")]

ORD_PATH = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")),
                        "UniversalToolkit", "orders.json")


SET_PATH = os.path.join(os.path.dirname(ORD_PATH), "settings.json")


ANN_PATH = os.path.join(os.path.dirname(ORD_PATH), "annotations.json")


def _json_default(o):
    """A non-standard object in the settings used to make json.dump fail silently - and EVERYTHING stopped saving."""
    try:
        return list(o)
    except Exception:
        return unicode(o)


def _read_json(path):
    try:
        with open(path, "rb") as f:
            raw = f.read()
        if raw[:3] == b"\xef\xbb\xbf":
            raw = raw[3:]
        return json.loads(raw.decode("utf-8"))
    except IOError:
        return None
    except Exception as ex:
        tk_log(u"read_json {}: {}".format(path, ex))
        # we do not silently overwrite a corrupted file: we keep a copy
        try:
            os.rename(path, path + ".broken")
        except Exception:
            pass
        return None


def _write_json(path, d):
    """Atomic write: temporary file + replace. Errors are written to the log, not swallowed."""
    try:
        folder = os.path.dirname(path)
        if not os.path.isdir(folder):
            os.makedirs(folder)
        data = json.dumps(d, default=_json_default, indent=1, ensure_ascii=True)   # ASCII-only: no encoding problems
        if not isinstance(data, bytes):
            data = data.encode("utf-8")
        tmp = path + ".tmp"
        with open(tmp, "wb") as f:
            f.write(data)
        if os.path.exists(path):
            os.remove(path)
        os.rename(tmp, path)
        return True
    except Exception as ex:
        tk_log(u"write_json {}: {}".format(path, ex))
        return False


def load_settings():
    d = _read_json(SET_PATH)
    return d if isinstance(d, dict) else {}


def save_settings(d):
    return _write_json(SET_PATH, d)


# ---------------- Datum Integration (Auth + Context Lookup + 3D Deep Links) ----------------
DATUM_DEFAULT_URL = u"http://localhost:8080"


def datum_get_cfg():
    s = load_settings()
    return {
        u"url": unicode(s.get("datum_url") or DATUM_DEFAULT_URL).rstrip(u"/"),
        u"token": unicode(s.get("datum_token") or u""),
        u"user": unicode(s.get("datum_user") or u""),
        u"role": unicode(s.get("datum_role") or u"Guest"),
    }


def datum_save_cfg(url=None, token=None, user=None, role=None):
    s = load_settings()
    if url is not None:
        s["datum_url"] = unicode(url).strip().rstrip(u"/") or DATUM_DEFAULT_URL
    if token is not None:
        s["datum_token"] = unicode(token)
    if user is not None:
        s["datum_user"] = unicode(user)
    if role is not None:
        s["datum_role"] = unicode(role)
    save_settings(s)


def datum_open_url(path_or_url):
    try:
        cfg = datum_get_cfg()
        target = unicode(path_or_url or u"")
        if target.startswith(u"/"):
            target = cfg[u"url"] + target
        elif not target.startswith(u"http"):
            target = cfg[u"url"] + u"/" + target
        System.Diagnostics.Process.Start(target)
    except Exception as ex:
        tk_log(u"datum_open_url: {}".format(ex))


def datum_type_url(sel_ctx):
    ctx = sel_ctx or {}
    pairs = [(u"view", u"type")]
    for k, v in (
        (u"category", ctx.get("category")),
        (u"family", ctx.get("family")),
        (u"type", ctx.get("typeName")),
    ):
        if v:
            pairs.append((k, unicode(v)))
    prms = ctx.get("params") or {}
    for pk, qk in (
        (u"Fire Rating", u"fire"),
        (u"Function", u"func"),
        (u"Width", u"width"),
        (u"Acoustic Rating", u"acoustic"),
    ):
        if prms.get(pk):
            pairs.append((qk, unicode(prms[pk])))
    layers = ctx.get("layers") or []
    if layers:
        try:
            pairs.append((u"layers", unicode(json.dumps(layers, ensure_ascii=True, separators=(",", ":")))))
        except Exception:
            pass
    qs = u"&".join([u"{}={}".format(k, System.Uri.EscapeDataString(v)) for k, v in pairs])
    return u"/?" + qs


def datum_http_json(endpoint, payload=None, token=None, timeout=3.5):
    import urllib2
    try:
        System.Net.ServicePointManager.SecurityProtocol = System.Net.SecurityProtocolType.Tls12
    except Exception:
        pass
    cfg = datum_get_cfg()
    url = str(cfg[u"url"]) + str(endpoint)
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    tok = token if token is not None else cfg[u"token"]
    if tok:
        headers["Authorization"] = "Bearer " + str(tok)
    data = json.dumps(payload, ensure_ascii=True) if payload is not None else None
    req = urllib2.Request(url, data=data, headers=headers)
    resp = urllib2.urlopen(req, timeout=timeout)
    raw = resp.read().decode("utf-8")
    return json.loads(raw)


def datum_login(email, password=u"", server_url=None):
    if server_url:
        datum_save_cfg(url=server_url)
    res = datum_http_json("/api/revit/auth", {"email": email, "password": password})
    if res and res.get("ok") and res.get("token"):
        u = res.get("user") or {}
        datum_save_cfg(
            token=res.get("token"),
            user=u.get("name") or u.get("email") or email,
            role=u.get("role") or u"Member",
        )
    return res


def datum_lookup(sel_ctx=None, query=u""):
    payload = dict(sel_ctx or {})
    if query:
        payload["query"] = query
    return datum_http_json("/api/revit/lookup", payload)


def datum_read_selection(ua):
    ctx = {"category": "", "family": "", "typeName": "", "params": {}, "layers": [], "label": ""}
    try:
        ad = ua.ActiveUIDocument
        if ad is None:
            return ctx
        d = ad.Document
        ids = list(ad.Selection.GetElementIds())
        if not ids:
            return ctx
        el = d.GetElement(ids[0])
        if el is None:
            return ctx
        if el.Category is not None:
            ctx["category"] = unicode(el.Category.Name)
        try:
            et = d.GetElement(el.GetTypeId())
            if et is not None:
                try:
                    ctx["family"] = unicode(et.FamilyName)
                except Exception:
                    pass
                try:
                    p_tn = et.get_Parameter(DB.BuiltInParameter.ALL_MODEL_TYPE_NAME)
                    ctx["typeName"] = unicode(p_tn.AsString() if p_tn else et.Name)
                except Exception:
                    try:
                        ctx["typeName"] = unicode(et.Name)
                    except Exception:
                        pass
                for pname in (u"Fire Rating", u"Function", u"Width", u"Acoustic Rating"):
                    try:
                        pr = et.LookupParameter(pname) or el.LookupParameter(pname)
                        if pr and pr.HasValue:
                            val = pr.AsString() or pr.AsValueString()
                            if val:
                                ctx["params"][pname] = unicode(val)
                    except Exception:
                        pass
                try:
                    cs = et.GetCompoundStructure()
                    if cs is not None:
                        fc = cs.GetFirstCoreLayerIndex()
                        lc = cs.GetLastCoreLayerIndex()
                        for idx, ly in enumerate(cs.GetLayers()):
                            fn_s = unicode(ly.Function)
                            w_mm = round(float(ly.Width) * 304.8, 1)
                            mat_name = fn_s
                            mat_col = u""
                            try:
                                mid = ly.MaterialId
                                if mid is not None and mid != DB.ElementId.InvalidElementId:
                                    mat = d.GetElement(mid)
                                    if mat is not None:
                                        if mat.Name:
                                            mat_name = unicode(mat.Name)
                                        c = mat.Color
                                        if c is not None and c.IsValid:
                                            mat_col = u"#{:02X}{:02X}{:02X}".format(int(c.Red), int(c.Green), int(c.Blue))
                            except Exception:
                                pass
                            is_core = 1 if (fc >= 0 and lc >= fc and fc <= idx <= lc) else (1 if fn_s == u"Structure" else 0)
                            ctx["layers"].append({
                                "n": mat_name,
                                "f": fn_s,
                                "mm": w_mm,
                                "c": mat_col,
                                "core": is_core,
                            })
                except Exception:
                    pass
        except Exception:
            pass
        parts = [x for x in (ctx["category"], ctx["family"], ctx["typeName"]) if x]
        ctx["label"] = u" - ".join(parts)
    except Exception as ex:
        tk_log(u"datum_read_selection: {}".format(ex))
    return ctx


DATUM_LOGIN_XAML = u"""
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Sign in to Datum" Width="420" Height="446"
        WindowStartupLocation="CenterScreen" ResizeMode="NoResize" Topmost="True"
        Background="#141416" Foreground="#F5F5F7" FontFamily="Segoe UI, Arial">
  <Grid>
    <Grid.RowDefinitions>
      <RowDefinition Height="3"/>
      <RowDefinition Height="*"/>
    </Grid.RowDefinitions>
    <Border Grid.Row="0">
      <Border.Background>
        <LinearGradientBrush StartPoint="0,0" EndPoint="1,0">
          <GradientStop Color="#0A84FF" Offset="0"/>
          <GradientStop Color="#BF5AF2" Offset="0.33"/>
          <GradientStop Color="#FF6482" Offset="0.66"/>
          <GradientStop Color="#FF9F0A" Offset="1"/>
        </LinearGradientBrush>
      </Border.Background>
    </Border>
    <StackPanel Grid.Row="1" Margin="22,18,22,18">
      <StackPanel Orientation="Horizontal" Margin="0,0,0,14">
        <Border Width="34" Height="34" CornerRadius="9" Margin="0,0,11,0">
          <Border.Background>
            <LinearGradientBrush StartPoint="0,0" EndPoint="1,1">
              <GradientStop Color="#2997FF" Offset="0"/>
              <GradientStop Color="#0A84FF" Offset="0.55"/>
              <GradientStop Color="#5E5CE6" Offset="1"/>
            </LinearGradientBrush>
          </Border.Background>
          <Viewbox Width="28" Height="28">
            <Grid Width="32" Height="32">
              <Path Stroke="#80FFFFFF" StrokeThickness="1.4" StrokeStartLineCap="Round" StrokeEndLineCap="Round"
                    Data="M16,4 L16,7.5 M16,24.5 L16,28 M4,16 L7.5,16 M24.5,16 L28,16"/>
              <Path Fill="#FFFFFF" Data="F0 M9,9 H15.8 C20,9 23,11.8 23,16 C23,20.2 20,23 15.8,23 H9 Z M12,11.8 V20.2 H15.6 C18.1,20.2 19.8,18.6 19.8,16 C19.8,13.4 18.1,11.8 15.6,11.8 Z"/>
              <Ellipse Width="4" Height="4" Fill="#FFFFFF" HorizontalAlignment="Center" VerticalAlignment="Center" Margin="2,0,0,0"/>
            </Grid>
          </Viewbox>
        </Border>
        <StackPanel VerticalAlignment="Center">
          <TextBlock Text="Sign in to Datum" FontSize="16" FontWeight="Bold" Foreground="#F5F5F7"/>
          <TextBlock Text="Sync BIM standards, 3D assemblies &amp; role access" FontSize="11.5" Foreground="#8E8E93"/>
        </StackPanel>
      </StackPanel>
      <Button x:Name="btnDatumGoogle" Background="#FFFFFF" Foreground="#111111" BorderThickness="0" Padding="12,9" Margin="0,0,0,12" Cursor="Hand">
        <StackPanel Orientation="Horizontal" HorizontalAlignment="Center" VerticalAlignment="Center">
          <Viewbox Width="16" Height="16" Margin="0,0,9,0">
            <Canvas Width="24" Height="24">
              <Path Fill="#4285F4" Data="M23.5,12.3 C23.5,11.5 23.4,10.7 23.3,10 H12 V14.5 H18.5 C18.2,16 17.4,17.2 16.1,18 V21 H20 C22.2,19 23.5,15.9 23.5,12.3 Z"/>
              <Path Fill="#34A853" Data="M12,24 C15.2,24 18,22.9 20,21 L16.1,18 C15,18.7 13.6,19.2 12,19.2 C8.9,19.2 6.2,17.1 5.3,14.2 H1.3 V17.3 C3.3,21.3 7.3,24 12,24 Z"/>
              <Path Fill="#FBBC05" Data="M5.3,14.2 C5.1,13.5 4.9,12.8 4.9,12 C4.9,11.2 5.1,10.5 5.3,9.8 V6.7 H1.3 C0.5,8.3 0,10.1 0,12 C0,13.9 0.5,15.7 1.3,17.3 L5.3,14.2 Z"/>
              <Path Fill="#EA4335" Data="M12,4.8 C13.8,4.8 15.4,5.4 16.6,6.6 L20.1,3.1 C18,1.2 15.2,0 12,0 C7.3,0 3.3,2.7 1.3,6.7 L5.3,9.8 C6.2,6.9 8.9,4.8 12,4.8 Z"/>
            </Canvas>
          </Viewbox>
          <TextBlock Text="Continue with Google" FontSize="13" FontWeight="SemiBold" Foreground="#111111" VerticalAlignment="Center"/>
        </StackPanel>
      </Button>
      <Grid Margin="0,0,0,8">
        <Grid.ColumnDefinitions>
          <ColumnDefinition Width="*"/>
          <ColumnDefinition Width="Auto"/>
          <ColumnDefinition Width="*"/>
        </Grid.ColumnDefinitions>
        <Border Grid.Column="0" Height="1" Background="#2C2C2E" VerticalAlignment="Center"/>
        <TextBlock Grid.Column="1" Text="or email" FontSize="11" Foreground="#6E6E73" Margin="10,0,10,0"/>
        <Border Grid.Column="2" Height="1" Background="#2C2C2E" VerticalAlignment="Center"/>
      </Grid>
      <TextBlock Text="Datum Server URL" FontSize="11.5" Foreground="#A1A1A6" Margin="0,2,0,4"/>
      <TextBox x:Name="tbDatumUrl" Background="#1C1C1E" Foreground="#F5F5F7" BorderBrush="#3A3A3C" Padding="9,7"/>
      <TextBlock Text="Work Email" FontSize="11.5" Foreground="#A1A1A6" Margin="0,9,0,4"/>
      <TextBox x:Name="tbDatumEmail" Background="#1C1C1E" Foreground="#F5F5F7" BorderBrush="#3A3A3C" Padding="9,7"/>
      <TextBlock Text="Password (optional in local dev)" FontSize="11.5" Foreground="#A1A1A6" Margin="0,9,0,4"/>
      <PasswordBox x:Name="tbDatumPass" Background="#1C1C1E" Foreground="#F5F5F7" BorderBrush="#3A3A3C" Padding="9,7"/>
      <TextBlock x:Name="tbDatumErr" Text="" FontSize="11.5" Foreground="#FF453A" Margin="0,8,0,0" TextWrapping="Wrap"/>
      <DockPanel Margin="0,12,0,0">
        <Button x:Name="btnDatumSignOut" Content="Sign out" DockPanel.Dock="Left"
                Background="#2C2C2E" Foreground="#A1A1A6" Padding="12,7"/>
        <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
          <Button x:Name="btnDatumCancel" Content="Cancel" Background="#2C2C2E" Foreground="#F5F5F7" Padding="14,7" Margin="0,0,8,0"/>
          <Button x:Name="btnDatumOk" Content="Sign in" IsDefault="True" Background="#0071E3" Foreground="#FFFFFF" FontWeight="SemiBold" Padding="18,7"/>
        </StackPanel>
      </DockPanel>
    </StackPanel>
  </Grid>
</Window>
"""


def datum_open_login_dialog(owner_hwnd=None, on_done=None):
    tk_log(u"datum_open_login_dialog: start")
    try:
        w = XamlReader.Load(XmlReader.Create(StringReader(DATUM_LOGIN_XAML)))
        try:
            if owner_hwnd:
                WindowInteropHelper(w).Owner = owner_hwnd
            elif uiapp and uiapp.MainWindowHandle:
                WindowInteropHelper(w).Owner = uiapp.MainWindowHandle
        except Exception as ex:
            tk_log(u"datum login owner: {}".format(ex))
        cfg = datum_get_cfg()
        tb_url = w.FindName(u"tbDatumUrl")
        tb_em = w.FindName(u"tbDatumEmail")
        tb_pw = w.FindName(u"tbDatumPass")
        tb_err = w.FindName(u"tbDatumErr")
        tb_url.Text = cfg[u"url"]
        tb_em.Text = cfg[u"user"] if u"@" in cfg[u"user"] else u"maxim@planit.studio"

        oauth_state = {u"listener": None, u"timer": None, u"result": None, u"srv_url": cfg[u"url"]}

        def stop_oauth():
            try:
                if oauth_state[u"timer"] is not None:
                    oauth_state[u"timer"].Stop()
                    oauth_state[u"timer"] = None
            except Exception:
                pass
            try:
                if oauth_state[u"listener"] is not None:
                    oauth_state[u"listener"].Stop()
                    oauth_state[u"listener"] = None
            except Exception:
                pass

        def do_google(s, e):
            stop_oauth()
            try:
                from System.Net import IPAddress
                from System.Net.Sockets import TcpListener
                from System.Text import Encoding
                from System.Threading import Thread as NetThread, ThreadStart as NetThreadStart

                srv_url = (tb_url.Text or cfg[u"url"]).strip().rstrip(u"/") or DATUM_DEFAULT_URL
                oauth_state[u"srv_url"] = srv_url
                lst = TcpListener(IPAddress.Loopback, 0)
                lst.Start()
                oauth_state[u"listener"] = lst
                port = lst.LocalEndpoint.Port
                cb_url = u"http://127.0.0.1:{}/cb".format(port)

                def accept_loop():
                    try:
                        while oauth_state[u"listener"] is lst:
                            cli = lst.AcceptTcpClient()
                            try:
                                ns = cli.GetStream()
                                buf = System.Array.CreateInstance(System.Byte, 8192)
                                n = ns.Read(buf, 0, 8192)
                                req = Encoding.UTF8.GetString(buf, 0, n) if n > 0 else u""
                                first = req.split(u"\r\n")[0] if req else u""
                                path_qs = first.split(u" ")[1] if len(first.split(u" ")) > 1 else u""
                                if path_qs.startswith(u"/cb"):
                                    params = {}
                                    if u"?" in path_qs:
                                        for part in path_qs.split(u"?", 1)[1].split(u"&"):
                                            if u"=" in part:
                                                k, v = part.split(u"=", 1)
                                                params[k] = System.Uri.UnescapeDataString(v.replace(u"+", u" "))
                                    html_body = u"<html><body style='background:#141416;color:#f5f5f7;font-family:Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'><div style='text-align:center'><h2>Signed in to Datum</h2><p style='color:#a1a1a6'>You can close this tab and return to Revit.</p></div></body></html>"
                                    hb = Encoding.UTF8.GetBytes(html_body)
                                    hdr = Encoding.ASCII.GetBytes(
                                        u"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n".format(len(hb))
                                    )
                                    ns.Write(hdr, 0, len(hdr))
                                    ns.Write(hb, 0, len(hb))
                                    ns.Flush()
                                    oauth_state[u"result"] = params
                                    break
                                else:
                                    hdr404 = Encoding.ASCII.GetBytes(u"HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n")
                                    ns.Write(hdr404, 0, len(hdr404))
                            finally:
                                try:
                                    cli.Close()
                                except Exception:
                                    pass
                    except Exception as ex_acc:
                        tk_log(u"google oauth accept: {}".format(ex_acc))

                t = NetThread(NetThreadStart(accept_loop))
                t.IsBackground = True
                t.Start()

                tm = DispatcherTimer()
                tm.Interval = TimeSpan.FromMilliseconds(80)

                def on_poll(ts, te):
                    res = oauth_state[u"result"]
                    if not res:
                        return
                    stop_oauth()
                    u_name = res.get(u"name") or res.get(u"email") or u"Google User"
                    datum_save_cfg(
                        url=oauth_state[u"srv_url"],
                        token=res.get(u"token") or u"",
                        user=u_name,
                        role=res.get(u"role") or u"Member",
                    )
                    w.Close()
                    if on_done:
                        on_done({u"name": u_name, u"email": res.get(u"email") or u"", u"role": res.get(u"role") or u"Member"})

                tm.Tick += on_poll
                oauth_state[u"timer"] = tm
                tm.Start()

                tb_err.Foreground = isl_brush(u"#2997FF")
                tb_err.Text = u"Waiting for Google sign-in in browser..."
                System.Diagnostics.Process.Start(
                    u"{}/?revit_auth_cb={}".format(srv_url, System.Uri.EscapeDataString(cb_url))
                )
            except Exception as ex:
                tb_err.Foreground = isl_brush(u"#FF453A")
                tb_err.Text = u"Google sign-in error: {}".format(ex)

        def do_login(s, e):
            tb_err.Foreground = isl_brush(u"#FF453A")
            try:
                res = datum_login(tb_em.Text.strip(), tb_pw.Password, tb_url.Text.strip())
                if res and res.get("ok"):
                    w.Close()
                    if on_done:
                        on_done(res.get("user"))
                else:
                    tb_err.Text = unicode((res or {}).get("error") or u"Login failed")
            except Exception as ex:
                tb_err.Text = u"Connection error: {}".format(ex)

        def do_signout(s, e):
            datum_save_cfg(token=u"", user=u"", role=u"Guest")
            w.Close()
            if on_done:
                on_done(None)

        w.Closed += lambda s, e: stop_oauth()
        w.FindName(u"btnDatumGoogle").Click += do_google
        w.FindName(u"btnDatumOk").Click += do_login
        w.FindName(u"btnDatumSignOut").Click += do_signout
        w.FindName(u"btnDatumCancel").Click += lambda s, e: w.Close()
        w.ShowDialog()
    except Exception as ex:
        tk_log(u"datum_open_login_dialog ERR: {}\n{}".format(ex, traceback.format_exc()))
        try:
            MessageBox.Show(u"Datum Sign In error:\n{}".format(ex), u"Datum")
        except Exception:
            pass


def load_ann_store(settings):
    """Favorites/sets/notes live in a separate file annotations.json: another write to settings.json
    (island position, export...) can no longer wipe them. Old data is pulled from settings.json."""
    d = _read_json(ANN_PATH)
    if not isinstance(d, dict):
        d = settings.get("ann") if isinstance(settings.get("ann"), dict) else {}
        if d:
            _write_json(ANN_PATH, d)
    return d


def save_ann_store(d):
    return _write_json(ANN_PATH, d)


def safe_name(txt):
    return re.sub(u'[\\\\/:*?"<>|]', u"_", txt or u"").strip() or u"print"


# ---------- export to CAD formats: file naming ----------
EXP_FORMATS = [u"pdf", u"dxf", u"dwg", u"dwf", u"dwfx", u"dgn"]
EXP_TPL = u"{prefix}-{type} - {number} - {name}"
EXP_VT = {u"FloorPlan": u"Floor Plan", u"CeilingPlan": u"Ceiling Plan", u"Elevation": u"Elevation",
          u"ThreeD": u"3D View", u"Schedule": u"Schedule", u"DrawingSheet": u"Sheet",
          u"DraftingView": u"Drafting View", u"Legend": u"Legend", u"Section": u"Section",
          u"Detail": u"Detail View", u"AreaPlan": u"Area Plan", u"EngineeringPlan": u"Structural Plan",
          u"PanelSchedule": u"Panel Schedule", u"Rendering": u"Rendering"}


def view_kind_word(v):
    """The view type word in the file name (as in Revit Automatic - Long): Sheet, Floor Plan, 3D View..."""
    if isinstance(v, ViewSheet):
        return u"Sheet"
    try:
        vt = unicode(v.ViewType)
    except Exception:
        return u"View"
    return EXP_VT.get(vt) or re.sub(u"(?<!^)(?=[A-Z])", u" ", vt)


def build_export_name(tpl, prefix, kind, number, name, group, setname, idx, dots=True):
    """File name (without extension) from the template. Tokens: {prefix} {type} {number} {name} {group} {set} {idx}."""
    num = number or u""
    if dots:
        num = num.replace(u".", u"-")
    vals = {u"prefix": prefix or u"", u"type": kind or u"", u"number": num, u"name": name or u"",
            u"group": group or u"", u"set": setname or u"", u"idx": u"{:02d}".format(int(idx))}

    def sub(m):
        v = vals.get(m.group(1).lower())
        if v is None:
            return m.group(0)
        return re.sub(u'[\\\\/:*?"<>|\\x00-\\x1f]', u"_", v)
    s = re.sub(u"\\{(\\w+)\\}", sub, tpl or EXP_TPL, flags=re.U)
    s = s.replace(u" -  - ", u" - ")              # empty number (ordinary views, not sheets)
    s = s.strip().lstrip(u"- ").rstrip(u" .")      # empty prefix -> no leading hyphen; Windows does not like a trailing dot
    return s or u"export"


def nat(txt):
    return [(0, int(t)) if t.isdigit() else (1, t.lower())
            for t in re.split(r"(\d+)", txt or u"") if t != u""]


def load_orders():
    try:
        with open(ORD_PATH, "r") as f:
            return json.load(f)
    except Exception:
        return {}


def save_orders(d):
    try:
        folder = os.path.dirname(ORD_PATH)
        if not os.path.isdir(folder):
            os.makedirs(folder)
        with open(ORD_PATH, "w") as f:
            json.dump(d, f)
    except Exception:
        pass


def sort_key(v):
    return (0, nat(v.SheetNumber)) if isinstance(v, ViewSheet) else (1, nat(v.Name))


def bind_hint(tb, hint):
    def f(s, e):
        hint.Visibility = Visibility.Collapsed if tb.Text else Visibility.Visible
    tb.TextChanged += f


def find_sv(o):
    """Find the ScrollViewer inside the ListBox (to keep the scroll position)."""
    if isinstance(o, ScrollViewer):
        return o
    for i in range(VisualTreeHelper.GetChildrenCount(o)):
        r = find_sv(VisualTreeHelper.GetChild(o, i))
        if r is not None:
            return r
    return None


class Handler(IExternalEventHandler):
    """Action queue: no action is lost if several are pressed in a row."""
    def __init__(self):
        self.queue = []          # [(key, func)]
        self.on_error = None
        self.on_begin = None     # TKX: action log / Undo group
        self.on_end = None

    def Execute(self, uiapp):
        q, self.queue = self.queue, []
        for key, func in q:
            ctx = None
            if self.on_begin:
                try:
                    ctx = self.on_begin(key, func, uiapp)
                except Exception as ex0:
                    tk_log(u"handler on_begin: {}".format(ex0))
                    ctx = None
            err, tb = None, None
            try:
                func(uiapp)
            except Exception as ex:
                err, tb = ex, traceback.format_exc()
            if ctx is not None and self.on_end:
                try:
                    self.on_end(ctx, err, tb, uiapp)
                except Exception as ex1:
                    tk_log(u"handler on_end: {}".format(ex1))
            if err is not None and self.on_error:
                self.on_error(u"Error: {}".format(err))

    def GetName(self):
        return "UniversalToolkitHandler"


from System import Array
from collections import OrderedDict
from System.Data import DataTable as TileDataTable
from System.Windows.Data import Binding as TileBinding, BindingMode as TileBindingMode
from System.Windows.Controls import (DataGridTextColumn as TileGridTextColumn, DataGridLength as TileGridLength,
                                     DataGridLengthUnitType as TileGridLengthUnit, Grid as TileGrid,
                                     ColumnDefinition as TileColumn, TextBox as TileTextBox)
from System.Windows import GridLength as TileGridLengthStruct, HorizontalAlignment as TileHAlign
from System.Windows.Controls import DataGridCheckBoxColumn as TileGridCheckColumn

# ---------------------------------------------------------------------------
#  Params: table of parameters of the selected elements (a toolkit tab)
# ---------------------------------------------------------------------------
TILE_DEFAULT_PARAMS = []   # columns are chosen by the user with the "Columns" button; the choice is remembered per model
TILE_HINT = u"Select elements in Revit and click \"Refresh from selection\"."
TILE_KINDS = {"String": u"text", "Integer": u"integer", "Double": u"number", "ElementId": u"element id"}


TILE_SEP = u"\x1f"     # column key: "Name" or "Name\x1f<parameter identity>" (when there are several identical names)


def tile_ident(p):
    """Stable parameter identity (independent of the name): built-in / shared (GUID) / project (Id)."""
    try:
        bip = p.Definition.BuiltInParameter
        if int(bip) != -1:      # BuiltInParameter.INVALID = -1 (shared/project parameters)
            return u"b:%d" % int(bip)
    except Exception:
        pass
    try:
        if p.IsShared:
            return u"g:%s" % p.GUID
    except Exception:
        pass
    try:
        return u"i:%d" % id_value(p.Id)
    except Exception:
        return u"n:"


def tile_split(key):
    if TILE_SEP in key:
        n, i = key.split(TILE_SEP, 1)
        return n, i
    return key, None


def tile_title(key):
    """Column label: for identically named parameters adds the type (built-in / shared / project)."""
    name, ident = tile_split(key)
    if ident is None:
        return name
    kind = {u"b": u"built-in", u"g": u"shared", u"i": u"project"}.get(ident[:1], u"other")
    extra = u" " + ident[2:10] if ident[:1] in (u"g", u"i") else u""
    return u"%s (%s%s)" % (name, kind, extra)


def tile_sources(el):
    out = [(el, False)]
    try:
        tid = el.GetTypeId()
        if tid is not None and tid != DB.ElementId.InvalidElementId:
            t = el.Document.GetElement(tid)
            if t is not None:
                out.append((t, True))
    except Exception:
        pass
    return out


def tile_find(el, key, inst_only=False):
    """(parameter, taken_from_type). Instance first, then type. For a key with identity - exactly that parameter."""
    name, ident = tile_split(key)
    for src, is_type in tile_sources(el):
        if inst_only and is_type:
            continue
        try:
            if ident is None:
                p = src.LookupParameter(name)
                if p is not None:
                    return p, is_type
            else:
                for p in src.GetParameters(name):
                    if tile_ident(p) == ident:
                        return p, is_type
        except Exception:
            continue
    return None, False


def tile_param(el, name):
    return tile_find(el, name)


def tile_set(el, name, val):
    p, _ = tile_find(el, name, True)   # writing - only to the instance parameter, the type is not touched
    if p is None or p.IsReadOnly:
        return False
    try:
        if p.StorageType == DB.StorageType.String:
            return bool(p.Set(val))
        return bool(p.SetValueString(val))
    except Exception:
        return False


def tile_candidates(doc, ids, limit=300):
    """All parameters of the selected elements: {key: {kind, rw, ro, inst, n}}. Identically named but different parameters
    (e.g. built-in Level and custom project Level) - separate keys, nothing is merged."""
    by_name = {}
    for eid in list(ids)[:limit]:
        el = doc.GetElement(eid)
        if el is None:
            continue
        for src, is_type in tile_sources(el):
            try:
                plist = list(src.Parameters)
            except Exception:
                continue
            for p in plist:
                try:
                    name = p.Definition.Name
                except Exception:
                    continue
                if not name:
                    continue
                ident = tile_ident(p)
                info = by_name.setdefault(name, {}).get(ident)
                if info is None:
                    info = by_name[name][ident] = {"kind": TILE_KINDS.get(str(p.StorageType), u""),
                                                   "rw": 0, "ro": 0, "inst": 0, "n": 0}
                info["n"] += 1
                if is_type or p.IsReadOnly:
                    info["ro"] += 1
                else:
                    info["rw"] += 1
                if not is_type:
                    info["inst"] += 1
    out = {}
    for name, idents in by_name.items():
        if len(idents) == 1:
            out[name] = list(idents.values())[0]
        else:
            for ident, info in idents.items():
                out[name + TILE_SEP + ident] = info
    return out


def tile_label(name, info):
    name = tile_title(name)
    if not info:
        return name
    bits = []
    if info["kind"]:
        bits.append(info["kind"])
    if info["rw"] == 0:
        bits.append(u"read-only")
    elif info["inst"] == 0:
        bits.append(u"type parameter")
    return name + (u"   ·   " + u", ".join(bits) if bits else u"")


# ---------------------------------------------------------------------------
#  View Naming: keywords (view parameters) -> values for the set -> view names
# ---------------------------------------------------------------------------
from System.Windows.Input import Cursors
from System.Windows.Controls import Orientation
from System.Windows.Controls import TextBox as WpfTextBox
from System.Windows import GridLength as NmGridLength, GridUnitType as NmGridUnit
NM_DEFAULT_KEYWORDS = []   # words are added by the user with the "+ Word" button
NM_DEFAULT_TEMPLATE = u"{VIEW}"
NM_BASE_MODES = [u"View's Title on Sheet", u"Beginning of the current name (before \" - \")"]
NM_TOKEN_RE = re.compile(u'\\{([^{}]+)\\}')
NM_BAD_CHARS = u'\\:{}[]|;<>?`~'
NM_EMPTY_HINT = u"Select a set on the left. Nothing changes until you click \"Apply\"."


def nm_valid_name(name):
    if not name or name != name.strip():
        return False
    try:
        return bool(NamingUtils.IsValidName(name))
    except Exception:
        return not any(c in NM_BAD_CHARS for c in name)


def nm_skip_type(view):
    for n in ("Legend", "Schedule", "ColumnSchedule", "PanelSchedule", "Report"):
        t = getattr(DB.ViewType, n, None)
        if t is not None and view.ViewType == t:
            return True
    return False


def nm_modify(text, ops):
    """Also: {WORD|last}, {WORD|first}, {WORD|butlast}, {WORD|before:X}, {WORD|after:X}, {WORD|upper}."""
    for op in ops:
        op = op.strip()
        low = op.lower()
        try:
            if low == u"last":
                w = text.split()
                text = w[-1] if w else u""
            elif low == u"first":
                w = text.split()
                text = w[0] if w else u""
            elif low == u"butlast":
                text = u" ".join(text.split()[:-1])
            elif low == u"upper":
                text = text.upper()
            elif low.startswith(u"before:"):
                text = text.split(op[7:])[0].strip()
            elif low.startswith(u"after:"):
                sep = op[6:]
                text = text.split(sep, 1)[1].strip() if sep in text else u""
            else:
                return None
        except Exception:
            return u""
    return text


def nm_add_issue(issues, text):
    if text not in issues:
        issues.append(text)


def nm_render(template, values, issues):
    def sub(m):
        raw = m.group(1)
        parts = raw.split(u"|")
        key = parts[0].strip().upper()
        if key not in values:
            nm_add_issue(issues, u"no word {" + parts[0].strip() + u"}")
            return u""
        val = values[key]
        if len(parts) > 1:
            val = nm_modify(val, parts[1:])
            if val is None:
                nm_add_issue(issues, u"unknown modifier in {" + raw + u"}")
                return u""
        if not val:
            nm_add_issue(issues, u"empty value {" + raw + u"}")
        return val
    return NM_TOKEN_RE.sub(sub, template)


def nm_base(row, mode):
    """{VIEW}: Title on Sheet (if empty - the beginning of the current name) or the beginning of the current name."""
    if mode == 0 and row["title"]:
        return row["title"]
    return row["cur"].split(u" - ")[0].strip()


NM_SEP = u"\u203A"
NM_DARK = BrushConverter().ConvertFromString("#F5F5F7")
NM_OKBLUE = BrushConverter().ConvertFromString("#4DA3FF")
NM_RED = BrushConverter().ConvertFromString("#FF6B6B")
NM_SEGBG = BrushConverter().ConvertFromString("#E9E9EE")
# how to apply a keyword: one value for the whole set / separately for groups / separately for each sheet
NM_MODES = [(u"all", u"All"), (u"group", u"Groups"), (u"sheet", u"Sheets")]
NM_MODE_MAX = {u"all": 0, u"group": 1, u"sheet": 2}
NM_DEFAULT_MODES = {}


def nm_keys(folders, sheet_num):
    """Scope keys from general to specific: set -> groups/subgroups -> sheet."""
    keys = [u""]
    for i in range(len(folders)):
        keys.append(NM_SEP.join(folders[:i + 1]))
    keys.append(NM_SEP.join(list(folders) + [u"#" + sheet_num]))
    return keys


def nm_levels(folders):
    """Scope levels, parallel to nm_keys: 0 = set, 1 = group/subgroup, 2 = sheet."""
    return [0] + [1] * len(folders) + [2]


def nm_pick(nodes, keys, levels, kw=None, mode=u"group"):
    """The nearest to the sheet own value (kw) or template (kw=None).
    Word values are taken only from the levels allowed by the word mode (All / Groups / Sheets)."""
    top = NM_MODE_MAX.get(mode, 1)
    for i in range(len(keys) - 1, -1, -1):
        if kw is not None and levels[i] > top:
            continue
        node = nodes.get(keys[i])
        if not isinstance(node, dict):
            continue
        if kw is None:
            v = node.get("template")
        else:
            vv = node.get("values")
            v = vv.get(kw) if isinstance(vv, dict) else None
        if isinstance(v, basestring) and v.strip():
            return v.strip(), keys[i]
    return None, None


def nm_node_active(node, level, modes):
    """Whether the scope has effective settings (values hidden by the word mode are not counted)."""
    if not isinstance(node, dict):
        return False
    if isinstance(node.get("template"), basestring) and node["template"].strip():
        return True
    vv = node.get("values")
    if isinstance(vv, dict):
        for kw, v in vv.items():
            if isinstance(v, basestring) and v.strip() and level <= NM_MODE_MAX.get(modes.get(kw, u"group"), 1):
                return True
    return False


def nm_param(view, kw):
    """(real name, value, read-only) of a text parameter of the view or None."""
    try:
        pr = view.LookupParameter(kw)
        if pr is None or pr.StorageType != DB.StorageType.String:
            return None
        return (pr.Definition.Name, (pr.AsString() or u"").strip(), bool(pr.IsReadOnly))
    except Exception:
        return None


def nm_read_rows(doc, pairs, keywords):
    """Snapshot of the views on the sheets of the set: plain Python data only, parameters - keywords only.
    pairs: [(meta from the Print Sets index, sheet element)]."""
    rows, seen = [], set()
    for meta, sheet in pairs:
        snum = sheet.SheetNumber
        label = u"{} — {}".format(snum, sheet.Name)
        folders = list(meta.get("folders") or [])
        for vp_id in sheet.GetAllViewports():
            vp = doc.GetElement(vp_id)
            view = doc.GetElement(vp.ViewId) if vp is not None else None
            if not isinstance(view, DB.View) or nm_skip_type(view):
                continue
            vid = id_value(view.Id)
            if vid in seen:
                continue
            seen.add(vid)
            title = u""
            try:
                tp = view.get_Parameter(DB.BuiltInParameter.VIEW_DESCRIPTION)
                if tp is not None:
                    title = (tp.AsString() or u"").strip()
            except Exception:
                pass
            params = {}
            for kw in keywords:
                pv = nm_param(view, kw)
                if pv is not None:
                    params[kw.upper()] = pv
            rows.append({"sheet": label, "sheet_key": nat(snum), "sheet_id": id_value(sheet.Id), "sheet_num": snum,
                         "folders": folders, "keys": nm_keys(folders, snum), "levels": nm_levels(folders),
                         "view_id": vid, "vtype": str(view.ViewType), "cur": view.Name, "title": title,
                         "params": params})
    rows.sort(key=lambda r: ([nat(f) for f in r["folders"]], r["sheet_key"], nat(r["cur"])))
    return rows


def nm_param_names(doc, rows, limit=3):
    """Names of editable text parameters (for "+ Word"): taken from several views, not all."""
    names = {}
    for r in rows[:limit]:
        view = doc.GetElement(revit_id(r["view_id"]))
        if view is None:
            continue
        try:
            for pr in view.Parameters:
                try:
                    if pr.StorageType == DB.StorageType.String and not pr.IsReadOnly:
                        n = pr.Definition.Name
                        names[n.upper()] = n
                except Exception:
                    continue
        except Exception:
            continue
    return sorted(names.values(), key=lambda x: x.lower())


def nm_collect_taken(doc):
    """All view names of the model: type -> {name: id}. An expensive operation, so it is cached between refreshes."""
    taken = {}
    for v in FilteredElementCollector(doc).OfClass(DB.View):
        try:
            if v.IsTemplate:
                continue
            taken.setdefault(str(v.ViewType), {})[v.Name] = id_value(v.Id)
        except Exception:
            continue
    return taken


def nm_plan(rows, taken, keywords, modes, nodes, default_template, base_mode):
    """Pure calculation of the preview (without the Revit API).
    Word value = nearest own value per the word mode, otherwise the value from the view itself."""
    own = set(r["view_id"] for r in rows)
    plan = []
    for r in rows:
        issues, writes, vals = [], [], {}
        for kw in keywords:
            ov, _ = nm_pick(nodes, r["keys"], r["levels"], kw, modes.get(kw, u"group"))
            cur = r["params"].get(kw.upper())
            if ov is not None:
                vals[kw.upper()] = ov
                if cur is None:
                    nm_add_issue(issues, u"no parameter \"{}\"".format(kw))
                elif cur[2]:
                    nm_add_issue(issues, u"\"{}\" is read-only".format(kw))
                elif cur[1] != ov:
                    writes.append((cur[0], ov))
            else:
                vals[kw.upper()] = cur[1] if cur else u""
        vals[u"VIEW"] = nm_base(r, base_mode)
        tmpl, _ = nm_pick(nodes, r["keys"], r["levels"])
        tmpl = tmpl or default_template
        new = nm_render(tmpl, vals, issues).strip() if tmpl.strip() else u""
        if not tmpl.strip():
            nm_add_issue(issues, u"empty template")
        if not issues and not nm_valid_name(new):
            issues.append(u"the name contains forbidden characters")
        item = dict(r)
        item.update({"new": new, "writes": writes, "issues": issues, "st": "same", "status": u"No changes"})
        plan.append(item)
    counts = {}
    for it in plan:
        if not it["issues"]:
            counts[(it["vtype"], it["new"])] = counts.get((it["vtype"], it["new"]), 0) + 1
    for it in plan:
        owner = taken.get(it["vtype"], {}).get(it["new"])
        if it["issues"]:
            it["st"], it["status"] = "error", u"Error: " + u"; ".join(it["issues"])
        elif counts.get((it["vtype"], it["new"]), 0) > 1 or (it["new"] != it["cur"] and owner is not None and owner not in own):
            it["st"], it["status"] = "conflict", u"This name already exists"
        elif it["new"] != it["cur"]:
            it["st"], it["status"] = "ok", u"Will be changed"
        elif it["writes"]:
            it["st"], it["status"] = "ok", u"Refresh parameters"
    return plan


TK_LOG = os.path.join(DATA, 'toolkit_debug.log')


def tk_log(msg):
    """Short log of steps of the Params / Views tabs: after a failure you can see at which step everything failed."""
    try:
        if not os.path.isdir(DATA):
            os.makedirs(DATA)
        with open(TK_LOG, 'ab') as f:
            f.write((time.strftime('%H:%M:%S ') + msg + u'\n').encode('utf-8'))
    except Exception:
        pass


# Periodic timer handlers: their "> name / < name" entries are not written (they filled the log several times a second).
# Errors in them are still logged.
TK_QUIET_TRACE = (u"ann_poll_tick", u"ann_prev_tick")


def tk_trace(fn, owner=None, swallow_default=None):
    """Wrapper with a log. With owner, the handler on the WPF thread does NOT throw the exception further (an unhandled exception
    in a WPF event can close Revit), but shows the error in the status; without owner the exception goes into the Handler."""
    name = fn.__name__
    quiet = name in TK_QUIET_TRACE

    def wrapper(*args, **kwargs):
        if not quiet:
            tk_log(u'> ' + name)
        try:
            result = fn(*args, **kwargs)
            if not quiet:
                tk_log(u'< ' + name)
            return result
        except Cancelled:
            raise
        except Exception as ex:
            tk_log(u'! {}: {}\n{}'.format(name, ex, traceback.format_exc()))
            if owner is None:
                raise
            try:
                owner.note_error(name, ex, traceback.format_exc())
            except Exception:
                pass
            try:
                owner.set_status(u'Error: {}'.format(ex))
            except Exception:
                pass
            return swallow_default
    wrapper.__name__ = name
    return wrapper


# ---------------------------------------------------------------------------
#  Revit crash diagnostics: switches for the new tabs + interception of WPF exceptions
# ---------------------------------------------------------------------------
TK_ENABLE_TILE = True    # False = the Params tab is not created at all
TK_ENABLE_NM = True      # False = the "Views" tab is not created at all


def tk_strip_tabs(xaml):
    """Removes disabled tabs (button + page) from the main window XAML."""
    if not TK_ENABLE_TILE:
        xaml = re.sub(u'<RadioButton x:Name="tabTile"[^>]*/>', u'', xaml, flags=re.S)
        xaml = re.sub(u'<!-- ============ Tile Params ============ -->.*?(?=<!-- ============ View Naming)', u'', xaml, flags=re.S)
        xaml = xaml.replace(u'x:Name="homeTile"', u'x:Name="homeTile" Visibility="Collapsed"')
    if not TK_ENABLE_NM:
        xaml = re.sub(u'<RadioButton x:Name="tabNm"[^>]*/>', u'', xaml, flags=re.S)
        xaml = re.sub(u'<!-- ============ View Naming ============ -->.*?(?=<!-- ============ /pages ============ -->)', u'', xaml, flags=re.S)
        xaml = xaml.replace(u'x:Name="homeNm"', u'x:Name="homeNm" Visibility="Collapsed"')
    return xaml


_TK_GUARD = [False]


def tk_install_guard():
    """An unhandled exception in a WPF event/template kills Revit. Here we swallow it and write the full text to the log."""
    if _TK_GUARD[0]:
        return
    _TK_GUARD[0] = True
    try:
        from System.Windows.Threading import Dispatcher

        def on_unhandled(sender, e):
            try:
                ex = e.Exception
                tk_log(u'!!! WPF unhandled: {}: {}\n{}'.format(ex.GetType().FullName, ex.Message, ex.StackTrace))
                inner = ex.InnerException
                while inner is not None:
                    tk_log(u'    inner: {}: {}'.format(inner.GetType().FullName, inner.Message))
                    inner = inner.InnerException
            except Exception:
                pass
            e.Handled = True
        Dispatcher.CurrentDispatcher.UnhandledException += on_unhandled
        tk_log(u'guard: Dispatcher.UnhandledException installed')
    except Exception as ex:
        tk_log(u'guard failed: {}'.format(ex))
    try:
        import System

        def on_domain(sender, e):
            try:
                ex = e.ExceptionObject
                tk_log(u'!!! AppDomain unhandled: {}'.format(ex))
            except Exception:
                pass
        System.AppDomain.CurrentDomain.UnhandledException += on_domain
    except Exception:
        pass


# ---------------------------------------------------------------------------
#  Annotations: library of annotation types (previews, favorites, categories, descriptions)
# ---------------------------------------------------------------------------
clr.AddReference("System.Drawing")
import System.Drawing
import System.IO
from System.Drawing.Imaging import ImageFormat as AnnImageFormat
from System.Windows.Media.Imaging import BitmapImage, BitmapCacheOption
from System.Windows.Media import Stretch as AnnStretch
from System.Windows.Input import Cursors as AnnCursors
from System.Windows import HorizontalAlignment as AnnHAlign, FontStyles as AnnFontStyles
from System.Windows.Controls import Image as AnnImage, WrapPanel as AnnWrapPanel
from Autodesk.Revit.DB import CategoryType as AnnCategoryType
from System.Windows import LogicalTreeHelper, FrameworkElement
from System.Windows.Controls import RadioButton as CpRadio, ItemsControl as CpItems
from System.Windows.Controls.Primitives import ButtonBase as CpButtonBase
from System.Windows.Media import Visual as CpVisual
from System.Windows.Media.Effects import DropShadowEffect as CpShadow
from System.Windows.Media import ScaleTransform as AnScale, CompositionTarget, BitmapCache
from System.Windows.Media.Animation import FillBehavior as AnFill
from System.Windows.Media.Animation import DoubleAnimation as AnDouble, CubicEase as AnCubic, BackEase as AnBack, EasingMode as AnEasing
from Autodesk.Revit.DB import Options as AnnOptions, GeometryInstance as AnnGeomInstance
from System.Windows.Media import Pen as AnnPen, StreamGeometry as AnnStreamGeometry, GeometryDrawing as AnnGeometryDrawing, DrawingImage as AnnDrawingImage

ANN_SOURCES = [
    (u"Generic Annotations", "generic"),
    (u"Generic Annotations + Detail Items", "detail"),
    (u"All annotation types (together with tags)", "all"),
]
ANN_ALL, ANN_FAV, ANN_GROUPS, ANN_NONE = u"__all__", u"__fav__", u"__groups__", u"__none__"
_ANN_BRUSH = {}


def ann_brush(hexcol):
    b = _ANN_BRUSH.get(hexcol)
    if b is None:
        b = BrushConverter().ConvertFromString(hexcol)
        try:
            b.Freeze()
        except Exception:
            pass
        _ANN_BRUSH[hexcol] = b
    return b


# ===========================================================================
#  ISLAND THEME (light / dark): the same logic as the bottom strips - follows the Windows theme.
#  The base island palette is dark; light is obtained via a color map. Keys - UPPERCASE.
#  All values are different (and do not coincide with the colors that stay unchanged), so the map is inverted.
# ===========================================================================
TK_ISL = {u"light": False}

TK_LIGHT_MAP = {
    # surfaces
    u"#0F0F11": u"#ECECF1", u"#111113": u"#FDFDFE", u"#141416": u"#F8F8FB", u"#161618": u"#EDEDF2",
    u"#1C1C1E": u"#F2F2F7", u"#1F1F22": u"#E3E3E8", u"#222225": u"#E6E6EB", u"#26262A": u"#DCDCE1",
    u"#2C2C2E": u"#E5E5EA", u"#3A3A3C": u"#D4D4D9",
    # text / icons
    u"#F5F5F7": u"#1C1C1E", u"#E5E5EA": u"#333336", u"#D1D1D6": u"#3C3C43", u"#C7C7CC": u"#48484A",
    u"#A1A1A6": u"#6E6E73", u"#98989D": u"#76767B", u"#636366": u"#9A9AA0", u"#5A5A5E": u"#AEAEB2",
    # blue
    u"#0A84FF": u"#007AFF", u"#0F2A4D": u"#E5F0FF", u"#17407A": u"#D6E6FF", u"#2F6FD1": u"#8DB8FF",
    u"#4DA3FF": u"#0B6EE8", u"#60A5FA": u"#0A66D6", u"#93C5FD": u"#1F6FDB",
    # amber / red
    u"#FFD479": u"#6B4E00", u"#2A2210": u"#FFF6DD", u"#5A4318": u"#FFD9A0", u"#FF6B6B": u"#D93025",
    # semi-transparent overlays (hover / pressed / separators)
    u"#26FFFFFF": u"#26000000", u"#14FFFFFF": u"#14000000", u"#1AFFFFFF": u"#1A000000",
    u"#10FFFFFF": u"#10000000", u"#0DFFFFFF": u"#0D000000", u"#59FFFFFF": u"#59000000",
    u"#1F0A84FF": u"#1F007AFF", u"#3A2E0A": u"#FFF4D4", u"#2A2110": u"#FFF9EC",
}
TK_LIGHT_REV = {}
for _k, _v in TK_LIGHT_MAP.items():
    TK_LIGHT_REV[_v] = _k
# lime as TEXT/icon on a light background is unreadable -> a darker shade (the background stays lime)
TK_LIGHT_FG = {u"#2997FF": u"#0071E3"}
TK_LIGHT_FG_REV = {u"#0071E3": u"#2997FF"}
TK_NOTCH_DARK, TK_NOTCH_LIGHT = u"#000000", u"#FAFAFC"      # island body / notch


def isl_hex(h):
    """Dark island color -> color of the current theme."""
    if not TK_ISL[u"light"] or not h:
        return h
    return TK_LIGHT_MAP.get(h.upper(), h)


def isl_brush(h):
    return ann_brush(isl_hex(h))


_ISL_K = {u"HEAD_BG": u"#1C1C1E", u"BLUE_SOFT": u"#0F2A4D", u"BLUE": u"#007AFF", u"GRAY": u"#8E8E93",
          u"NM_DARK": u"#F5F5F7", u"NM_OKBLUE": u"#4DA3FF", u"NM_RED": u"#FF6B6B", u"NM_SEGBG": u"#E9E9EE"}


def isl_k(name):
    """Named island colors (formerly static brushes) taking the theme into account."""
    return isl_brush(_ISL_K[name])


_ISL_BRUSH_ATTRS = u"Background|Foreground|BorderBrush|Fill|Stroke|CaretBrush|HorizontalGridLinesBrush|VerticalGridLinesBrush"


def isl_key(h, fg=False):
    return u"Tk_" + h.upper().lstrip(u"#") + (u"_FG" if fg else u"")


def tk_isl_dyn(text):
    """Literal colors (dark palette) in brush attributes and Setters -> {DynamicResource Tk_XXXXXX}.
    The theme is switched by replacing the brushes in Window.Resources themselves, so templates/triggers/styles change together."""
    def keyfor(h, name):
        hu = h.upper()
        if name == u"Foreground" and hu in TK_LIGHT_FG:
            return isl_key(hu, True)
        if hu in TK_LIGHT_MAP:
            return isl_key(hu)
        return None

    def rep_attr(m):
        k = keyfor(m.group(2), m.group(1))
        return m.group(0) if k is None else u'%s="{DynamicResource %s}"' % (m.group(1), k)

    def rep_set(m):
        k = keyfor(m.group(3), m.group(2))
        return m.group(0) if k is None else u'%s"{DynamicResource %s}"' % (m.group(1), k)
    text = re.sub(u'(?<![A-Za-z.])(' + _ISL_BRUSH_ATTRS + u')="(#[0-9A-Fa-f]{6,8})"', rep_attr, text)
    text = re.sub(u'(Property="(' + _ISL_BRUSH_ATTRS + u')"\\s+Value=)"(#[0-9A-Fa-f]{6,8})"', rep_set, text)
    if TK_ISL[u"light"]:       # the remaining literals (Color="..." in system brushes etc.) - static
        text = re.sub(u'(Color=)"(#[0-9A-Fa-f]{6,8})"',
                      lambda m: u'%s"%s"' % (m.group(1), TK_LIGHT_MAP.get(m.group(2).upper(), m.group(2))), text)
    return text


def isl_brush_defs():
    """<SolidColorBrush x:Key="Tk_..."> for the current theme."""
    light = TK_ISL[u"light"]
    out = []
    for h in TK_LIGHT_MAP:
        out.append(u'<SolidColorBrush x:Key="%s" Color="%s"/>' % (isl_key(h), TK_LIGHT_MAP[h] if light else h))
    for h in TK_LIGHT_FG:
        out.append(u'<SolidColorBrush x:Key="%s" Color="%s"/>' % (isl_key(h, True), TK_LIGHT_FG[h] if light else h))
    return u"".join(out)


def tk_isl_prepare(src):
    src = tk_isl_dyn(src)
    src = src.replace(u'Foreground="{DynamicResource Tk_F5F5F7}" UseLayoutRounding', u'UseLayoutRounding', 1)
    return src.replace(u"<Window.Resources>", u"<Window.Resources>" + isl_brush_defs(), 1)


def isl_set_brushes(res):
    """Live switching: we replace the brushes in Window.Resources (this invalidates all DynamicResources)."""
    light = TK_ISL[u"light"]
    for h in TK_LIGHT_MAP:
        res[isl_key(h)] = ann_brush(TK_LIGHT_MAP[h] if light else h)
    for h in TK_LIGHT_FG:
        res[isl_key(h, True)] = ann_brush(TK_LIGHT_FG[h] if light else h)


def isl_color_hex(c):
    if int(c.A) == 255:
        return u"#%02X%02X%02X" % (int(c.R), int(c.G), int(c.B))
    return u"#%02X%02X%02X%02X" % (int(c.A), int(c.R), int(c.G), int(c.B))


def isl_conv(brush, kind, to_light):
    """New hex for a locally set SolidColorBrush or None (leave as is)."""
    if not isinstance(brush, SolidColorBrush):
        return None
    h = isl_color_hex(brush.Color)
    if kind == u"fg":
        n = (TK_LIGHT_FG if to_light else TK_LIGHT_FG_REV).get(h)
        if n is not None:
            return n
    n = (TK_LIGHT_MAP if to_light else TK_LIGHT_REV).get(h)
    if n is not None and n != h:
        return n
    return None


def isl_recolor_tree(root, to_light, style_map=None):
    """Recolors the LOCAL colors of logical tree elements (created in the XAML body and from Python).
    Templates/styles are changed separately - by replacing Window.Resources, we do not touch them here."""
    from System.Windows import LogicalTreeHelper, FrameworkElement, DependencyProperty, DependencyObject, Style
    from System.Windows.Controls import Control, Panel, TextBlock, Border as _Border
    from System.Windows.Shapes import Shape
    unset = DependencyProperty.UnsetValue
    spec = [(Control, ((Control.BackgroundProperty, u"bg"), (Control.ForegroundProperty, u"fg"), (Control.BorderBrushProperty, u"bd"))),
            (_Border, ((_Border.BackgroundProperty, u"bg"), (_Border.BorderBrushProperty, u"bd"))),
            (Panel, ((Panel.BackgroundProperty, u"bg"),)),
            (TextBlock, ((TextBlock.ForegroundProperty, u"fg"), (TextBlock.BackgroundProperty, u"bg"))),
            (Shape, ((Shape.FillProperty, u"bg"), (Shape.StrokeProperty, u"bd")))]
    stack = [root]
    seen = 0
    while stack:
        el = stack.pop()
        seen += 1
        try:
            for cls, dps in spec:
                if isinstance(el, cls):
                    for dp, kind in dps:
                        v = el.ReadLocalValue(dp)
                        if v is unset or v is None:
                            continue
                        n = isl_conv(v, kind, to_light)
                        if n is not None:
                            el.SetValue(dp, ann_brush(n))
            if style_map and isinstance(el, FrameworkElement):
                st = el.ReadLocalValue(FrameworkElement.StyleProperty)
                if isinstance(st, Style) and st in style_map:
                    el.Style = style_map[st]
            if isinstance(el, FrameworkElement):
                if el.HasResources and el is not root:
                    res = el.Resources
                    for k in list(res.Keys):
                        try:
                            v = res[k]
                            n = isl_conv(v, u"bg", to_light)
                            if n is not None:
                                res[k] = ann_brush(n)
                        except Exception:
                            pass
            for ch in LogicalTreeHelper.GetChildren(el):
                if isinstance(ch, DependencyObject):
                    stack.append(ch)
        except Exception as ex:
            tk_log(u"isl_recolor: {}".format(ex))
    return seen


def ann_el_name(el):
    try:
        n = el.Name
        if n:
            return n
    except Exception:
        pass
    try:
        p = el.get_Parameter(BuiltInParameter.SYMBOL_NAME_PARAM)
        if p is not None:
            return p.AsString() or u""
    except Exception:
        pass
    return u""


def ann_fam_name(sym):
    try:
        n = sym.FamilyName
        if n:
            return n
    except Exception:
        pass
    try:
        return sym.Family.Name
    except Exception:
        return u""


def ann_key(sym):
    return u"{}|{}".format(ann_fam_name(sym), ann_el_name(sym))


def ann_split_key(key):
    fam, _, typ = key.partition(u"|")
    return fam, typ


def ann_cat_matches(sym, mode):
    cat = sym.Category
    if cat is None:
        return False
    cid = id_value(cat.Id)
    if cid == int(BuiltInCategory.OST_GenericAnnotation):
        return True
    if mode == "generic":
        return False
    if cid == int(BuiltInCategory.OST_DetailComponents):
        return True
    if mode == "all":
        try:
            return cat.CategoryType == AnnCategoryType.Annotation
        except Exception:
            return False
    return False


_ANN_LOGGED = set()


def ann_log_once(tag, ex):
    if tag in _ANN_LOGGED:
        return
    _ANN_LOGGED.add(tag)
    tk_log(u"ann {}: {}".format(tag, ex))


def ann_is_blank(bmp):
    """Revit often returns an empty (white/transparent) image for annotations."""
    try:
        w, h = bmp.Width, bmp.Height
        st = max(1, min(w, h) // 12)
        for x in range(0, w, st):
            for y in range(0, h, st):
                c = bmp.GetPixel(x, y)
                if c.A > 16 and (c.R < 240 or c.G < 240 or c.B < 240):
                    return False
        return True
    except Exception:
        return False


def ann_preview(sym, px=96):
    """Stored Revit preview of the type -> BitmapImage; None if it is missing or empty."""
    bmp = None
    try:
        bmp = sym.GetPreviewImage(System.Drawing.Size(px, px))
        if bmp is None or ann_is_blank(bmp):
            return None
        ms = System.IO.MemoryStream()
        bmp.Save(ms, AnnImageFormat.Png)
        ms.Position = 0
        img = BitmapImage()
        img.BeginInit()
        img.CacheOption = BitmapCacheOption.OnLoad
        img.StreamSource = ms
        img.EndInit()
        img.Freeze()
        return img
    except Exception as ex:
        ann_log_once(u"GetPreviewImage", ex)
        return None
    finally:
        try:
            if bmp is not None:
                bmp.Dispose()
        except Exception:
            pass


ANN_CACHE_DAYS = 30


def ann_cache_paths(doc_title, key):
    import hashlib
    d = os.path.join(os.path.dirname(SET_PATH), u"ann_cache", hashlib.md5(doc_title.encode("utf-8")).hexdigest()[:12])
    return d, os.path.join(d, hashlib.md5(key.encode("utf-8")).hexdigest() + u".png")


def ann_cache_load(doc_title, key):
    """Preview from disk (30-day cache): without calling Revit and without temporary transactions."""
    try:
        d, p = ann_cache_paths(doc_title, key)
        if not os.path.isfile(p) or time.time() - os.path.getmtime(p) > ANN_CACHE_DAYS * 86400:
            return None
        img = BitmapImage()
        img.BeginInit()
        img.CacheOption = BitmapCacheOption.OnLoad
        img.UriSource = System.Uri(p)
        img.EndInit()
        img.Freeze()
        return img
    except Exception as ex:
        ann_log_once(u"cache load", ex)
        return None


def ann_cache_save(doc_title, key, img):
    try:
        from System.Windows.Media.Imaging import PngBitmapEncoder, BitmapFrame
        d, p = ann_cache_paths(doc_title, key)
        if not os.path.isdir(d):
            os.makedirs(d)
        enc = PngBitmapEncoder()
        enc.Frames.Add(BitmapFrame.Create(img))
        fs = System.IO.FileStream(p, System.IO.FileMode.Create)
        try:
            enc.Save(fs)
        finally:
            fs.Close()
    except Exception as ex:
        ann_log_once(u"cache save", ex)


def ann_cache_clear(doc_title):
    try:
        d, p = ann_cache_paths(doc_title, u"x")
        if os.path.isdir(d):
            for f in os.listdir(d):
                try:
                    os.remove(os.path.join(d, f))
                except Exception:
                    pass
    except Exception:
        pass


def ann_symbol_of(doc, el, strict=False):
    """Family type for an element. strict: only annotations and detail components (for the auto-badge)."""
    sym = None
    if isinstance(el, FamilyInstance):
        sym = el.Symbol
    elif el is not None:
        try:
            tp = doc.GetElement(el.GetTypeId())
            if isinstance(tp, FamilySymbol):
                sym = tp
        except Exception:
            sym = None
    if sym is None:
        return None
    if strict:
        try:
            cat = sym.Category
            ok = cat is not None and (cat.CategoryType == AnnCategoryType.Annotation
                                      or id_value(cat.Id) == int(BuiltInCategory.OST_DetailComponents))
        except Exception:
            ok = False
        if not ok:
            return None
    return sym


def ann_geom_polylines(inst, view):
    """Curves of the instance in view coordinates -> [[(u, v), ...], ...]."""
    try:
        opts = AnnOptions()
        opts.View = view
        opts.ComputeReferences = False
        ge = inst.get_Geometry(opts)
        if ge is None:
            return []
        right, up = view.RightDirection, view.UpDirection
    except Exception as ex:
        ann_log_once(u"get_Geometry", ex)
        return []
    out = []

    def walk(g):
        for o in g:
            if isinstance(o, AnnGeomInstance):
                try:
                    walk(o.GetInstanceGeometry())
                except Exception:
                    pass
            elif isinstance(o, Curve):
                try:
                    pts = [(p.DotProduct(right), p.DotProduct(up)) for p in o.Tessellate()]
                    if len(pts) > 1:
                        out.append(pts)
                except Exception:
                    pass
    walk(ge)
    return out


def ann_draw_preview(lines):
    """Vector preview from lines -> DrawingImage (None if there is nothing to draw)."""
    if not lines:
        return None
    xs = [p[0] for l in lines for p in l]
    ys = [p[1] for l in lines for p in l]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    w, h = maxx - minx, maxy - miny
    span = max(w, h)
    if span < 1e-9:
        return None
    size, box = 96.0, 88.0
    sc = box / span
    ox = (size - w * sc) / 2.0 - minx * sc
    oy = (size - h * sc) / 2.0 + maxy * sc
    sg = AnnStreamGeometry()
    ctx = sg.Open()
    try:
        for l in lines:
            ctx.BeginFigure(WPoint(l[0][0] * sc + ox, oy - l[0][1] * sc), False, False)
            for p in l[1:]:
                ctx.LineTo(WPoint(p[0] * sc + ox, oy - p[1] * sc), True, False)
    finally:
        ctx.Close()
    sg.Freeze()
    pen = AnnPen(ann_brush("#1C1C1E"), 1.4)
    try:
        pen.Freeze()
    except Exception:
        pass
    gd = AnnGeometryDrawing(None, pen, sg)
    gd.Freeze()
    di = AnnDrawingImage(gd)
    di.Freeze()
    return di


def ann_geom_temp(doc, view, sym):
    """Temporary instance in the view (call inside a Transaction that is then rolled back)."""
    try:
        if not sym.IsActive:
            sym.Activate()
            doc.Regenerate()
        inst = doc.Create.NewFamilyInstance(XYZ.Zero, sym, view)
        return ann_geom_polylines(inst, view)
    except Exception as ex:
        ann_log_once(u"temp instance", ex)
        return []


def cp_inside(el, roots):
    n = el
    while n is not None:
        for r in roots:
            if n is r:
                return True
        try:
            n = LogicalTreeHelper.GetParent(n)
        except Exception:
            return False
    return False


def cp_has_title(el):
    stack = [el]
    while stack:
        n = stack.pop()
        if isinstance(n, TextBlock) and n.FontSize >= 22:
            return True
        try:
            for ch in LogicalTreeHelper.GetChildren(n):
                if isinstance(ch, FrameworkElement):
                    stack.append(ch)
        except Exception:
            pass
    return False


ANN_BAR_XAML = u"""
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Annotations" WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        Topmost="False" ShowInTaskbar="False" SizeToContent="WidthAndHeight" ResizeMode="NoResize"
        WindowStartupLocation="Manual" FontFamily="Segoe UI Variable Text, Segoe UI, Arial" FontSize="12"
        TextOptions.TextFormattingMode="Ideal" UseLayoutRounding="True">
  <Grid x:Name="shell" Margin="16,12,16,22">
    <Border x:Name="shadow" CornerRadius="19" Background="#FFFFFF">
      <Border.Effect>
        <DropShadowEffect BlurRadius="30" ShadowDepth="8" Direction="270" Opacity="0.13" Color="#000000"/>
      </Border.Effect>
    </Border>
    <Border x:Name="card" CornerRadius="19" BorderThickness="1" BorderBrush="#14000000">
      <Border.Background>
        <LinearGradientBrush StartPoint="0,0" EndPoint="0,1">
          <GradientStop Color="#FAF9F9FB" Offset="0"/>
          <GradientStop Color="#F8F7F7F9" Offset="1"/>
        </LinearGradientBrush>
      </Border.Background>
      <Border x:Name="inner" CornerRadius="18" BorderThickness="0" Padding="7,4,6,4">
        <Grid x:Name="row">
          <Grid.ColumnDefinitions>
            <ColumnDefinition Width="Auto"/>
            <ColumnDefinition Width="Auto"/>
            <ColumnDefinition Width="Auto"/>
          </Grid.ColumnDefinitions>
          <StackPanel x:Name="rightPnl" Grid.Column="2" Orientation="Horizontal" VerticalAlignment="Center"
                      HorizontalAlignment="Right">
            <TextBlock x:Name="tbHint" Visibility="Collapsed" MaxWidth="280" Foreground="#8E8E93" FontSize="11"
                       Margin="8,0,8,0" VerticalAlignment="Center" TextTrimming="CharacterEllipsis"/>
            <Border x:Name="btnAdd" Visibility="Collapsed" Background="#0071E3" CornerRadius="13" Width="28" Height="26"
                    Margin="2,0" Cursor="Hand" VerticalAlignment="Center"
                    ToolTip="To favorites: add the type of the annotation selected in Revit">
              <TextBlock Text="&#xE735;" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" FontSize="13"
                         Foreground="#FFFFFF" HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <Border x:Name="btnSide" Width="28" Height="26" CornerRadius="13" Margin="2,0" Cursor="Hand"
                    Background="#09000000" VerticalAlignment="Center"
                    ToolTip="Placement mode">
              <Grid>
                <TextBlock x:Name="icSide" Text="&#xE765;" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets"
                           Foreground="#1C1C1E" FontSize="13" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                <TextBlock x:Name="lbSide" Visibility="Collapsed" Text=""/>
              </Grid>
            </Border>
            <Border x:Name="gapPnl" Visibility="Collapsed" Height="26" CornerRadius="13" Padding="3,0" Margin="2,0"
                    Background="#09000000" VerticalAlignment="Center"
                    ToolTip="Offset from geometry, mm on paper. Mouse wheel or +/- : 1 mm step (Shift - 5 mm). You can type a number and press Enter">
              <StackPanel Orientation="Horizontal" VerticalAlignment="Center">
                <TextBlock x:Name="icGap" Text="&#x2194;" FontSize="12" Margin="6,0,3,1" VerticalAlignment="Center"/>
                <Border x:Name="btnGapDn" Width="20" Height="20" CornerRadius="10" Background="#01000000" Cursor="Hand">
                  <TextBlock x:Name="icGapDn" Text="&#xE738;" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" FontSize="9"
                             HorizontalAlignment="Center" VerticalAlignment="Center"/>
                </Border>
                <TextBox x:Name="tbGap" Width="30" MaxLength="5" TextAlignment="Center" BorderThickness="0" Padding="0"
                         Background="Transparent" FontSize="12" VerticalAlignment="Center" VerticalContentAlignment="Center"/>
                <Border x:Name="btnGapUp" Width="20" Height="20" CornerRadius="10" Background="#01000000" Cursor="Hand">
                  <TextBlock x:Name="icGapUp" Text="&#xE710;" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" FontSize="9"
                             HorizontalAlignment="Center" VerticalAlignment="Center"/>
                </Border>
                <TextBlock x:Name="lbGapMm" Text="mm" FontSize="11" Margin="3,0,6,1" VerticalAlignment="Center"/>
              </StackPanel>
            </Border>
            <Border x:Name="btnMode" Width="28" Height="26" CornerRadius="13" Margin="2,0" Cursor="Hand"
                    Background="#09000000" VerticalAlignment="Center">
              <Grid>
                <TextBlock x:Name="icMode" Text="&#xE718;" FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets"
                           Foreground="#1C1C1E" FontSize="13" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                <TextBlock x:Name="lbMode" Visibility="Collapsed" Text=""/>
              </Grid>
            </Border>
            <StackPanel x:Name="swPnl" Orientation="Horizontal" Margin="8,0,0,0" VerticalAlignment="Center"/>
            <Border x:Name="btnBack" Width="28" Height="26" CornerRadius="13" Margin="12,0,0,0" Cursor="Hand"
                    Background="#01000000" VerticalAlignment="Center" ToolTip="Close the Annotations panel">
              <TextBlock Text="&#x2715;" Foreground="#8E8E93" FontSize="12" HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
          </StackPanel>
          <StackPanel x:Name="grp" Grid.Column="0" Orientation="Horizontal" HorizontalAlignment="Left"
                      VerticalAlignment="Center">
            <StackPanel x:Name="seg" Orientation="Horizontal" VerticalAlignment="Center"
                        ToolTip="Mouse wheel - switch the set"/>
            <Border x:Name="div" Width="1" Height="14" Background="#1A000000" Margin="7,0,6,0" VerticalAlignment="Center"/>
          </StackPanel>
          <WrapPanel x:Name="pnl" Grid.Column="1" Orientation="Horizontal" VerticalAlignment="Center"
                     HorizontalAlignment="Center"/>
        </Grid>
      </Border>
    </Border>
  </Grid>
</Window>
"""


ANN_BAR_PAL = {
    # Dark: the same black island, #161618 pills, #2C2C2E selection with lime text
    # Light: a light gray strip, selection - a black pill with lime text (island inversion)
    u"light": {
        "shadow": "#F5F5F7", "card_d": "#FFF5F5F7", "card_f": "#FFF5F5F7",
        "border_d": "#FFD1D1D6", "border_f": "#FFD1D1D6", "div": "#1A000000",
        "hint": "#6E6E73", "icon": "#6E6E73", "ghost": "#01000000", "ghost_h": "#14000000",
        "pill": "#FFE8E8ED", "pill_h": "#FFDCDCE1", "pill_t": "#1C1C1E",
        "seg_t": "#6E6E73", "seg_h": "#0F000000", "seg_sel_bg": "#FF1C1C1E", "seg_sel_t": "#2997FF",
        "acc": "#0071E3", "acc_h": "#2997FF", "acc_t": "#FFFFFF",
        "wasd_dot": "#FF7FA300", "num": "#FF6B8A00",
    },
    u"dark": {
        "shadow": "#000000", "card_d": "#FF000000", "card_f": "#FF000000",
        "border_d": "#FF2E2E32", "border_f": "#FF2E2E32", "div": "#26FFFFFF",
        "hint": "#8E8E93", "icon": "#C7C7CC", "ghost": "#01FFFFFF", "ghost_h": "#1FFFFFFF",
        "pill": "#FF161618", "pill_h": "#FF2C2C2E", "pill_t": "#F5F5F7",
        "seg_t": "#A1A1A6", "seg_h": "#1AFFFFFF", "seg_sel_bg": "#FF2C2C2E", "seg_sel_t": "#2997FF",
        "acc": "#0071E3", "acc_h": "#2997FF", "acc_t": "#FFFFFF",
        "wasd_dot": "#FFC8E64C", "num": "#FFC8E64C",
    },
}


def ann_sys_dark():
    """True if dark theme for apps is enabled in Windows."""
    try:
        from Microsoft.Win32 import Registry
        k = Registry.CurrentUser.OpenSubKey(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize")
        if k is None:
            return False
        v = k.GetValue("AppsUseLightTheme", 1)
        k.Close()
        return int(v) == 0
    except Exception:
        return False


def ann_bad_view(view):
    if view is None:
        return True
    for nm in ("ThreeD", "Schedule", "ColumnSchedule", "PanelSchedule", "Walkthrough", "Rendering",
               "Report", "CostReport", "LoadsReport", "PresureLossReport", "ProjectBrowser",
               "SystemBrowser", "Internal", "Undefined"):
        try:
            if view.ViewType == getattr(ViewType, nm):
                return True
        except Exception:
            pass
    return False


def ann_find_symbol(doc, key):
    fam, typ = ann_split_key(key)
    for sym in FilteredElementCollector(doc).OfClass(FamilySymbol):
        if ann_el_name(sym) == typ and ann_fam_name(sym) == fam:
            return sym
    return None



# ---- "To geometry" mode: the annotation is centered on a side of the geometry (W/A/S/D) ---------------------------
ANN_SIDE_GAP_MM = 15.0      # gap between the geometry and the nearest edge of the annotation (mm ON PAPER; in the model multiplied by the view scale)
ANN_SIDE_NEED_CAPS = True   # W/A/S/D work only with Caps Lock on (otherwise the keys go to Revit as usual)
ANN_SIDE_GAP_MIN, ANN_SIDE_GAP_MAX = 0.0, 300.0
ANN_SIDE_KEYS = {0x57: u"W", 0x41: u"A", 0x53: u"S", 0x44: u"D"}      # W up, A left, S down, D right
ANN_SIDE_NAMES = {u"W": u"top", u"A": u"left", u"S": u"bottom", u"D": u"right"}


def ann_side_extent(view, elements):
    """Element bounds in view coordinates: (min_right, max_right, min_up, max_up) in feet, or None."""
    right, up = view.RightDirection, view.UpDirection
    rs, us = [], []
    for el in elements:
        bb = None
        try:
            bb = el.get_BoundingBox(view)
        except Exception:
            bb = None
        if bb is None:
            try:
                bb = el.get_BoundingBox(None)
            except Exception:
                bb = None
        if bb is None:
            continue
        tr = bb.Transform
        if tr.IsIdentity:        # fast path: center + half-sizes instead of 8 corners via interop
            c = bb.Min.Add(bb.Max).Multiply(0.5)
            h = bb.Max.Subtract(bb.Min).Multiply(0.5)
            for ax, store in ((right, rs), (up, us)):
                m = c.DotProduct(ax)
                e = abs(h.X * ax.X) + abs(h.Y * ax.Y) + abs(h.Z * ax.Z)
                store.append(m - e)
                store.append(m + e)
            continue
        for x in (bb.Min.X, bb.Max.X):
            for y in (bb.Min.Y, bb.Max.Y):
                for z in (bb.Min.Z, bb.Max.Z):
                    pt = tr.OfPoint(XYZ(x, y, z))
                    rs.append(pt.DotProduct(right))
                    us.append(pt.DotProduct(up))
    if not rs:
        return None
    return min(rs), max(rs), min(us), max(us)


def ann_caps_on():
    """True if Caps Lock is on (the toggle, not the physical key press)."""
    try:
        import ctypes
        return bool(ctypes.windll.user32.GetKeyState(0x14) & 1)
    except Exception:
        return True


def ann_side_gap_ft(view, gap_mm=None):
    """Offset in mm on paper -> feet in view coordinates (annotations have a paper size, so we multiply by the scale)."""
    if gap_mm is None:
        gap_mm = ANN_SIDE_GAP_MM
    scale = 1
    if not isinstance(view, ViewSheet):
        try:
            scale = max(1, int(view.Scale))
        except Exception:
            scale = 1
    return float(gap_mm) / 304.8 * scale


def ann_side_place(doc, view, sym, ext, side, gap, cache=None, ckey=None):
    """Place an annotation instance next to the side (W/A/S/D) of the ext frame, centered on that side.
    The gap is counted from the real size of the annotation, not from its insertion point.
    The type's size is measured once (cache[ckey]) - then we place straight at the final point: no Regenerate and MoveElement."""
    right, up, vd = view.RightDirection, view.UpDirection, view.ViewDirection
    base = vd.Multiply(view.Origin.DotProduct(vd))

    def pt(r, u):
        return base.Add(right.Multiply(r)).Add(up.Multiply(u))
    r0, r1, u0, u1 = ext
    cr, cu = (r0 + r1) / 2.0, (u0 + u1) / 2.0

    def target(hr, hu):                       # where the center of the annotation frame should go
        if side == u"A":
            return r0 - gap - hr, cu
        if side == u"D":
            return r1 + gap + hr, cu
        if side == u"W":
            return cr, u1 + gap + hu
        return cr, u0 - gap - hu

    m = cache.get(ckey) if cache is not None else None
    if m:
        hr, hu, ofr, ofu = m
        wr, wu = target(hr, hu)
        return doc.Create.NewFamilyInstance(pt(wr - ofr, wu - ofu), sym, view)

    if side == u"A":
        tr, tu = r0 - gap, cu
    elif side == u"D":
        tr, tu = r1 + gap, cu
    elif side == u"W":
        tr, tu = cr, u1 + gap
    else:
        tr, tu = cr, u0 - gap
    inst = doc.Create.NewFamilyInstance(pt(tr, tu), sym, view)
    doc.Regenerate()
    be = ann_side_extent(view, [inst])
    if be is not None:
        hr, hu = (be[1] - be[0]) / 2.0, (be[3] - be[2]) / 2.0
        bcr, bcu = (be[0] + be[1]) / 2.0, (be[2] + be[3]) / 2.0
        wr, wu = target(hr, hu)
        dr, du = wr - bcr, wu - bcu
        if abs(dr) > 1e-9 or abs(du) > 1e-9:
            ElementTransformUtils.MoveElement(doc, inst.Id, right.Multiply(dr).Add(up.Multiply(du)))
        if cache is not None:
            cache[ckey] = (hr, hu, bcr - tr, bcu - tu)
    return inst


class AnnKeyHook(object):
    """W/A/S/D interception in the Revit thread (WH_KEYBOARD for this thread) while the "To geometry" mode is armed.
    Pressed keys are 'eaten' so Revit does not run its two-letter commands (W+A = Wall etc.).
    Does not touch keys if Ctrl/Alt/Shift is held, if the focus is in an input field or Revit is not the active window.
    If the hook could not be installed - fallback: polling GetAsyncKeyState (without 'eating')."""
    TEXT_CLASSES = (u"edit", u"richedit", u"combobox", u"hwndwrapper", u"scintilla", u"sysanimate")

    def __init__(self, main_hwnd, is_armed, on_key, on_esc):
        self.main_hwnd = main_hwnd
        self.is_armed = is_armed
        self.on_key = on_key
        self.on_esc = on_esc
        self.hook = None
        self.proc = None
        self.timer = None
        self.down = {}

    # ---- shared checks ----
    def _focus_ok(self):
        import ctypes
        u32 = ctypes.windll.user32
        fg = u32.GetForegroundWindow()
        if self.main_hwnd and (fg or 0) != self.main_hwnd:
            return False
        fh = u32.GetFocus()
        if fh:
            buf = ctypes.create_unicode_buffer(256)
            u32.GetClassNameW(fh, buf, 256)
            cls = buf.value.lower()
            for t in self.TEXT_CLASSES:
                if cls.startswith(t):
                    return False
        return True

    def _caps_ok(self):
        return (not ANN_SIDE_NEED_CAPS) or ann_caps_on()

    def _mods(self):
        import ctypes
        u32 = ctypes.windll.user32
        return any(u32.GetKeyState(vk) & 0x8000 for vk in (0x10, 0x11, 0x12))

    # ---- WH_KEYBOARD ----
    def _handle(self, vk, lp):
        if vk not in ANN_SIDE_KEYS and vk != 0x1B:
            return False
        if not self.is_armed():
            return False
        lp = lp & 0xFFFFFFFF
        is_down = (lp & 0x80000000) == 0
        repeat = (lp & 0x40000000) != 0
        if vk == 0x1B:
            if is_down:
                self.on_esc()
            return False
        if self._mods() or not self._focus_ok() or not self._caps_ok():
            return False
        if is_down and not repeat:
            self.on_key(ANN_SIDE_KEYS[vk])
        return True

    def install(self):
        if self.hook or self.timer is not None:
            return True
        try:
            import ctypes
            u32 = ctypes.windll.user32
            k32 = ctypes.windll.kernel32
            lres = ctypes.c_ssize_t if hasattr(ctypes, "c_ssize_t") else ctypes.c_longlong
            wpar = ctypes.c_size_t if hasattr(ctypes, "c_size_t") else ctypes.c_ulonglong
            proto = ctypes.WINFUNCTYPE(lres, ctypes.c_int, wpar, lres)
            u32.CallNextHookEx.argtypes = [ctypes.c_void_p, ctypes.c_int, wpar, lres]
            u32.CallNextHookEx.restype = lres
            u32.SetWindowsHookExW.argtypes = [ctypes.c_int, proto, ctypes.c_void_p, ctypes.c_uint]
            u32.SetWindowsHookExW.restype = ctypes.c_void_p
            u32.UnhookWindowsHookEx.argtypes = [ctypes.c_void_p]
            me = self

            def proc(code, wp, lp):
                try:
                    if code == 0 and me._handle(int(wp), int(lp)):
                        return 1
                except Exception:
                    pass
                return u32.CallNextHookEx(None, code, wp, lp)
            self.proc = proto(proc)                     # we keep a reference, otherwise the GC kills the callback
            h = u32.SetWindowsHookExW(2, self.proc, None, k32.GetCurrentThreadId())
            if not h:
                raise RuntimeError(u"SetWindowsHookEx returned 0")
            self.hook = h
            return True
        except Exception as ex:
            tk_log(u"ann side hook: {} -> fallback key polling".format(ex))
            self.proc = None
            self.hook = None
        try:
            t = DispatcherTimer()
            t.Interval = TimeSpan.FromMilliseconds(30)
            t.Tick += lambda s, e: self._poll()
            self.timer = t
            t.Start()
            return True
        except Exception as ex:
            tk_log(u"ann side poll: {}".format(ex))
            self.timer = None
            return False

    def _poll(self):
        try:
            import ctypes
            if not self.is_armed():
                return
            u32 = ctypes.windll.user32
            for vk, ch in ANN_SIDE_KEYS.items():
                st = bool(u32.GetAsyncKeyState(vk) & 0x8000)
                was = self.down.get(vk, False)
                self.down[vk] = st
                if st and not was and not self._mods() and self._focus_ok() and self._caps_ok():
                    self.on_key(ch)
            if u32.GetAsyncKeyState(0x1B) & 0x8000:
                self.on_esc()
        except Exception:
            pass

    def uninstall(self):
        try:
            if self.hook:
                import ctypes
                ctypes.windll.user32.UnhookWindowsHookEx(self.hook)
        except Exception as ex:
            tk_log(u"ann side unhook: {}".format(ex))
        self.hook = None
        self.proc = None
        try:
            if self.timer is not None:
                self.timer.Stop()
        except Exception:
            pass
        self.timer = None


# Win32 AppBar: reserves a screen strip so that Revit (maximized) is not covered by the dock panel.
try:
    import ctypes as _ab_ct

    class ABAR_RECT(_ab_ct.Structure):
        _fields_ = [("left", _ab_ct.c_int), ("top", _ab_ct.c_int),
                    ("right", _ab_ct.c_int), ("bottom", _ab_ct.c_int)]

    class ABAR_DATA(_ab_ct.Structure):
        _fields_ = [("cbSize", _ab_ct.c_uint), ("hWnd", _ab_ct.c_void_p),
                    ("uCallbackMessage", _ab_ct.c_uint), ("uEdge", _ab_ct.c_uint),
                    ("rc", ABAR_RECT), ("lParam", _ab_ct.c_void_p)]
except Exception:
    ABAR_DATA = None


# ---- Shared AppBar strip manager (view maker + annotation panel) -------------------------------------
# Each strip used to reserve space by itself and recalculate nothing else: when a neighboring strip
# closed/collapsed/changed height, an empty reserved hole remained between the bottom strip and the taskbar.
# Now all strips register here, and after any change the reservations are removed and set again
# from the bottom up (order 0 - closest to the taskbar), so there are no holes.
ABAR_REG = []                        # [{'key','order','win','height','place','reg'}]
ABAR_STATE = {'busy': False, 'heal': 0}


def _abar_scale(win):
    try:
        src = System.Windows.PresentationSource.FromVisual(win)
        return float(src.CompositionTarget.TransformToDevice.M11) if src is not None else 1.0
    except Exception:
        return 1.0


def _abar_unreg_all():
    import ctypes
    for e in ABAR_REG:
        if not e.get('reg'):
            continue
        e['reg'] = False
        try:
            abd = ABAR_DATA()
            abd.cbSize = ctypes.sizeof(ABAR_DATA)
            abd.hWnd = e.get('hwnd') or 0
            ctypes.windll.shell32.SHAppBarMessage(1, ctypes.byref(abd))   # ABM_REMOVE
        except Exception as ex:
            tk_log(u'appbar remove {}: {}'.format(e.get('key'), ex))


def abar_relayout():
    """Remove all reservations and set them again from the bottom up. Returns the set of keys that were registered."""
    if ABAR_DATA is None or ABAR_STATE['busy']:
        return set(e['key'] for e in ABAR_REG if e.get('reg'))
    ABAR_STATE['busy'] = True
    done = set()
    try:
        import ctypes
        user32, shell = ctypes.windll.user32, ctypes.windll.shell32
        _abar_unreg_all()
        sw, sh = int(user32.GetSystemMetrics(0)), int(user32.GetSystemMetrics(1))
        for e in sorted(ABAR_REG, key=lambda x: x['order']):
            try:
                win = e['win']
                hwnd = WindowInteropHelper(win).Handle.ToInt64()
                if not hwnd:
                    continue
                sc = _abar_scale(win)
                abd = ABAR_DATA()
                abd.cbSize = ctypes.sizeof(ABAR_DATA)
                abd.hWnd = hwnd
                abd.uCallbackMessage = int(user32.RegisterWindowMessageW(u'ToolkitBarMsg_' + e['key']))
                if not shell.SHAppBarMessage(0, ctypes.byref(abd)):   # ABM_NEW
                    continue
                e['reg'], e['hwnd'] = True, hwnd
                abd.uEdge = 3   # ABE_BOTTOM
                abd.rc.left, abd.rc.top, abd.rc.right, abd.rc.bottom = 0, 0, sw, sh
                shell.SHAppBarMessage(2, ctypes.byref(abd))   # ABM_QUERYPOS (takes into account the taskbar and strips already placed lower)
                width_dip = (abd.rc.right - abd.rc.left) / sc
                h_px = int(round(float(e['height'](width_dip)) * sc))
                abd.rc.top = abd.rc.bottom - h_px
                shell.SHAppBarMessage(3, ctypes.byref(abd))   # ABM_SETPOS
                e['place'](abd.rc.left / sc, abd.rc.top / sc, (abd.rc.right - abd.rc.left) / sc, h_px / sc)
                done.add(e['key'])
            except Exception as ex:
                tk_log(u'appbar relayout {}: {}'.format(e.get('key'), ex))
    except Exception as ex:
        tk_log(u'appbar relayout: {}'.format(ex))
    finally:
        ABAR_STATE['busy'] = False
    abar_corners()
    return done


def abar_corners():
    """The topmost of the strips (highest above the taskbar) gets rounded top corners, the rest - straight."""
    try:
        act = [e for e in ABAR_REG if e.get('reg')]
        top = max(act, key=lambda x: x['order'])['key'] if act else None
        for e in ABAR_REG:
            cb = e.get('corners')
            if cb is not None:
                try:
                    cb(e['key'] == top)
                except Exception as ex:
                    tk_log(u'appbar corners {}: {}'.format(e['key'], ex))
    except Exception as ex:
        tk_log(u'appbar corners: {}'.format(ex))


def abar_set(key, order, win, height, place, corners=None):
    """Add/update a strip and recalculate all. True - the strip is registered."""
    if ABAR_DATA is None:
        return False
    ABAR_STATE['heal'] = 0
    for e in ABAR_REG:
        if e['key'] == key:
            e.update(order=order, win=win, height=height, place=place, corners=corners)
            break
    else:
        ABAR_REG.append({'key': key, 'order': order, 'win': win, 'height': height, 'place': place, 'reg': False,
                         'corners': corners})
    if ABAR_STATE['busy']:
        return any(e['key'] == key and e.get('reg') for e in ABAR_REG)
    return key in abar_relayout()


def abar_drop(key):
    """Remove a strip and immediately pull up the rest (so no empty space remains)."""
    ABAR_STATE['heal'] = 0
    mine = [e for e in ABAR_REG if e['key'] == key]
    if not mine:
        return
    _abar_unreg_all_one(mine[0])
    ABAR_REG[:] = [e for e in ABAR_REG if e['key'] != key]
    if ABAR_REG and not ABAR_STATE['busy']:
        abar_relayout()


def _abar_unreg_all_one(e):
    if not e.get('reg'):
        return
    try:
        import ctypes
        abd = ABAR_DATA()
        abd.cbSize = ctypes.sizeof(ABAR_DATA)
        abd.hWnd = e.get('hwnd') or 0
        ctypes.windll.shell32.SHAppBarMessage(1, ctypes.byref(abd))   # ABM_REMOVE
    except Exception as ex:
        tk_log(u'appbar remove {}: {}'.format(e.get('key'), ex))
    e['reg'] = False


def fade_win(win, to, ms=170, done=None, start=None):
    """Smooth window opacity change (native WPF animation, outside Python timers)."""
    try:
        da = AnDouble()
        if start is not None:
            da.From = float(start)
        da.To = float(to)
        da.Duration = System.Windows.Duration(TimeSpan.FromMilliseconds(ms))
        ease = AnCubic()
        ease.EasingMode = AnEasing.EaseOut
        da.EasingFunction = ease
        def fin(s, e, w=win, v=float(to)):
            try:
                w.BeginAnimation(System.Windows.UIElement.OpacityProperty, None)
                w.Opacity = v
            except Exception:
                pass
            if done is not None:
                done()
        da.Completed += fin
        win.BeginAnimation(System.Windows.UIElement.OpacityProperty, da)
    except Exception as ex:
        tk_log(u"fade_win: {}".format(ex))
        try:
            win.Opacity = float(to)
        except Exception:
            pass
        if done is not None:
            done()


def slide_top(win, old_top, new_top, ms=190):
    """The strip shifted after the AppBars were recalculated (a neighbor was hidden/shown) - it slides, not jumps."""
    try:
        if abs(old_top - new_top) < 2.0 or abs(old_top - new_top) > 400.0:
            return
        da = AnDouble()
        da.From = float(old_top)
        da.To = float(new_top)
        da.Duration = System.Windows.Duration(TimeSpan.FromMilliseconds(ms))
        ease = AnCubic()
        ease.EasingMode = AnEasing.EaseOut
        da.EasingFunction = ease
        da.FillBehavior = AnFill.Stop
        ABAR_STATE['anim_until'] = time.time() + ms / 1000.0 + 0.3
        win.BeginAnimation(System.Windows.Window.TopProperty, da)
    except Exception as ex:
        tk_log(u"slide_top: {}".format(ex))


def abar_check():
    """Called by the strip timers: if the strips do not stand flush against each other and the taskbar
    (the taskbar was moved, a foreign AppBar appeared/disappeared) - recalculate. No more than 2 attempts in a row."""
    if ABAR_DATA is None or ABAR_STATE['busy']:
        return
    if time.time() < ABAR_STATE.get('anim_until', 0.0):
        return     # the strips are sliding now - do not treat this as a "hole"
    act = [e for e in sorted(ABAR_REG, key=lambda x: x['order']) if e.get('reg')]
    if not act:
        ABAR_STATE['heal'] = 0
        return
    try:
        import ctypes
        shell = ctypes.windll.shell32
        tb = ABAR_DATA()
        tb.cbSize = ctypes.sizeof(ABAR_DATA)
        expect = tb.rc.top if (shell.SHAppBarMessage(5, ctypes.byref(tb)) and tb.uEdge == 3) else None   # ABM_GETTASKBARPOS
        bad = False
        for e in act:
            w = e['win']
            sc = _abar_scale(w)
            top, bottom = int(round(w.Top * sc)), int(round((w.Top + w.ActualHeight) * sc))
            if expect is not None and abs(bottom - expect) > 3:
                bad = True
                break
            expect = top
        if not bad:
            ABAR_STATE['heal'] = 0
        elif ABAR_STATE['heal'] < 2:
            ABAR_STATE['heal'] += 1
            abar_relayout()
    except Exception as ex:
        tk_log(u'appbar check: {}'.format(ex))


# ---- Strip switch: View Creation / Annotations / Both ------------------------------------------------
# Both strips are separate AppBar windows. The switch sits at the right edge of each. "Hide" does not close
# the strip (the state is kept), it only releases its reserved space and hides the window; "Both" shows both at once.
_TK_MAIN = [None]            # PrintSetWindow: needed to control the Annotations strip
BAR_SW_ITEMS = ((u"vm", u"\uE7C4", u"View Creation: show / hide the view creation strip"),
                (u"ann", u"\uE8EC", u"Annotations: show / hide the annotations strip"))


def _bar_ann_dict():
    main = _TK_MAIN[0]
    b = getattr(main, "bar", None) if main is not None else None
    return b if isinstance(b, dict) else {}


def _detach_el(el):
    """Detach an element from its current parent (to move it to another window)."""
    p = el.Parent
    if p is None:
        return
    if hasattr(p, 'Children'):
        p.Children.Remove(el)
    elif hasattr(p, 'Child'):
        p.Child = None
    elif hasattr(p, 'Content'):
        p.Content = None


def bars_merge_ok(vm):
    """Whether View Creation and Annotations can be shown as one strip: both visible, Annotations docked,
    and its left part (next to the set tabs) has enough width for the panel."""
    b = _bar_ann_dict()
    if vm is None or vm.hidden or b.get('win') is None or b.get('hidden') or b.get('mode') != 'dock':
        return False
    try:
        area = System.Windows.SystemParameters.WorkArea
        inf = float('inf')
        b['seg'].Measure(System.Windows.Size(inf, inf))
        seg_w = float(b['seg'].DesiredSize.Width)
        pnl = b['pnl']
        pnl.Measure(System.Windows.Size(float(pnl.MaxWidth), inf))
        center_w = float(pnl.DesiredSize.Width)
        vm.vmPanel.Measure(System.Windows.Size(inf, inf))
        vm_w = float(vm.vmPanel.DesiredSize.Width)
        avail = (area.Width - center_w) / 2.0 - 36.0
        need = seg_w + vm_w + 12.0 + (0.0 if vm.merged else 24.0)     # margin: so it does not jitter back and forth
        return need <= avail
    except Exception as ex:
        tk_log(u'bars_merge_ok: {}'.format(ex))
        return False


def bars_layout_update():
    """Merge/split the strips according to the current state and the screen width."""
    if ABAR_STATE.get('lay_busy'):
        return
    ABAR_STATE['lay_busy'] = True
    try:
        vm, main = _VM[0], _TK_MAIN[0]
        if vm is None or main is None:
            return
        ok = bars_merge_ok(vm)
        if ok and not vm.merged:
            vm.merge_into(main)
        elif not ok and vm.merged:
            vm.unmerge()
    except Exception as ex:
        tk_log(u'bars_layout_update: {}'.format(ex))
    finally:
        ABAR_STATE['lay_busy'] = False


def bar_state():
    """Which strips are visible now: u'vm' / u'ann' / u'both' / None."""
    vm = _VM[0]
    vm_on = vm is not None and not getattr(vm, "hidden", False)
    b = _bar_ann_dict()
    ann_on = b.get("win") is not None and not b.get("hidden")
    if vm_on and ann_on:
        return u"both"
    if vm_on:
        return u"vm"
    if ann_on:
        return u"ann"
    return None


def bar_sync():
    """Redraw the switch on both strips according to the actual state."""
    st = bar_state()
    vm = _VM[0]
    if vm is not None:
        try:
            vm.sw_paint(st)
        except Exception as ex:
            tk_log(u"bar_sync vm: {}".format(ex))
    main = _TK_MAIN[0]
    if main is not None and _bar_ann_dict().get("win") is not None:
        try:
            main.ann_bar_sw_paint(st)
        except Exception as ex:
            tk_log(u"bar_sync ann: {}".format(ex))
    if main is not None:
        try:
            main.hdr_paint(st)
        except Exception as ex:
            tk_log(u"bar_sync hdr: {}".format(ex))
    bars_layout_update()


def bar_switch(mode):
    """mode: u'vm' | u'ann' | u'both'. First shows the needed strips (opens them if they do not exist yet),
    and only when they have really appeared - hides the extra ones, so that nothing is ever left on screen."""
    if mode not in (u"vm", u"ann", u"both"):
        return
    main = _TK_MAIN[0]
    want_vm, want_ann = mode in (u"vm", u"both"), mode in (u"ann", u"both")
    if want_vm:
        try:
            if _VM[0] is None:
                open_view_maker(uiapp)
            else:
                _VM[0].bar_show()
        except Exception as ex:
            tk_log(u"bar_switch open vm: {}\n{}".format(ex, traceback.format_exc()))
    if want_ann and main is not None:
        try:
            if _bar_ann_dict().get("win") is None:
                main.ann_bar_open()
            else:
                main.ann_bar_unhide()
        except Exception as ex:
            tk_log(u"bar_switch open ann: {}\n{}".format(ex, traceback.format_exc()))
    vm = _VM[0]
    ok_vm = vm is not None and not vm.hidden
    ok_ann = _bar_ann_dict().get("win") is not None and not _bar_ann_dict().get("hidden")
    if (ok_vm or not want_vm) and (ok_ann or not want_ann):
        try:
            if not want_vm and vm is not None:
                vm.bar_hide()
            if not want_ann and main is not None and _bar_ann_dict().get("win") is not None:
                main.ann_bar_hide()
        except Exception as ex:
            tk_log(u"bar_switch hide: {}".format(ex))
    else:
        tk_log(u"bar_switch: could not show the strip (vm={}, ann={}) - not hiding the other one".format(ok_vm, ok_ann))
    bar_sync()


def bar_toggle(which):
    """Two independent toggles instead of three buttons (VM / Ann / Both): both on = Both.
    The last visible strip is not turned off - at least one always remains on screen."""
    st = bar_state()
    vm_on, ann_on = st in (u"vm", u"both"), st in (u"ann", u"both")
    if which == u"vm":
        vm_on = not vm_on
    else:
        ann_on = not ann_on
    if vm_on or ann_on:
        bar_switch(u"both" if (vm_on and ann_on) else (u"vm" if vm_on else u"ann"))
    bar_sync()


def bar_after_close(which):
    """The strip was closed. If View Creation was closed and Annotations was hidden - show it, otherwise
    no panel will remain."""
    if which == u"vm":
        main = _TK_MAIN[0]
        if main is not None and _bar_ann_dict().get("win") is not None:
            main.ann_bar_unhide()
    bar_sync()


# "island" dimensions (must match the XAML: island 1000x680, margin 28)
ISL_EXP_W, ISL_EXP_H = 1000.0, 680.0
ISL_PILL_W, ISL_PILL_H = 252.0, 34.0
ISL_PAD = 28.0

# mini mode: a small icon in the Revit title bar (next to the account)
MINI_SZ = 20.0          # icon size, DIP
MINI_TOP = 4.0          # offset from the top edge of the Revit window, DIP
MINI_DX_DEF = 362.0     # default distance from the right edge of Revit to the icon's right edge, DIP (can be dragged)
MINI_XAML = u'''<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Width="20" Height="20" WindowStyle="None"
        AllowsTransparency="True" Background="Transparent" ShowInTaskbar="False" ShowActivated="False"
        ResizeMode="NoResize" Topmost="False" UseLayoutRounding="True">
  <Border x:Name="mi" CornerRadius="10" Background="#0071E3" Cursor="Hand" ToolTip="Datum Toolkit: click - open, right click - panel mode, drag - move">
    <TextBlock FontFamily="Segoe Fluent Icons, Segoe MDL2 Assets" Text="&#xE90F;" Foreground="#FFFFFF"
               FontSize="10" HorizontalAlignment="Center" VerticalAlignment="Center"/>
  </Border>
</Window>'''


class PrintSetWindow(object):
    def __init__(self):
        tk_log(u'--- launch: PrintSetWindow.__init__ (tile={}, nm={}) ---'.format(TK_ENABLE_TILE, TK_ENABLE_NM))
        tk_install_guard()
        prev = _TK_MAIN[0]
        if prev is not None:
            try:
                prev.closed = True
            except Exception:
                pass
            for _tn in (u"_tkx_hk_timer", u"_ann_stimer", u"_ann_ptimer", u"_home_timer", u"_theme_timer"):
                try:
                    _tm = getattr(prev, _tn, None)
                    if _tm is not None:
                        _tm.Stop()
                except Exception:
                    pass
            try:
                if getattr(prev, "_tkx_pal", None) is not None:
                    prev._tkx_pal.Close()
            except Exception:
                pass
            try:
                if getattr(prev, "win", None) is not None:
                    prev.win.Close()
            except Exception:
                pass
        _TK_MAIN[0] = self
        TK_ISL[u"light"] = not ann_sys_dark()
        self.isl_raw = tk_strip_tabs(XAML)
        self.win = load_xaml(self.isl_raw, isl=True)
        try:
            # The owner is the Revit window: Windows itself hides/restores the island together with it on minimize
            # (it used to be an independent Topmost window and did not react to the Revit state)
            WindowInteropHelper(self.win).Owner = uiapp.MainWindowHandle
        except Exception as ex:
            tk_log(u"island owner: {}".format(ex))
        try:
            self.win.SetResourceReference(System.Windows.Controls.Control.ForegroundProperty, u"Tk_F5F5F7")
        except Exception as ex:
            tk_log(u"isl root foreground: {}".format(ex))
        tk_log(u'init: XAML loaded')
        names = ("dragA dragB btnClose btnPin btnRefresh tbSetSearch hSetSearch lstSets "
                 "tbNew hNew btnCreate tbTitle tbSub tbItemSearch hItemSearch lstItems "
                 "btnAdd chkCombined chkNative cmbFmt gridCombined gridNative pnlCad pnlSetup "
                 "cmbSetup tbPrefix tbTemplate txtNamePreview chkDots chkSub chkXref gridXref "
                 "txtPrintOrd popPrint btnPrintMore btnRevs btnMakeSets btnReplace btnRemove btnSelRevit "
                 "btnPrint btnPrintOrd btnSort btnDup btnRename btnDelete txtStatus tabPrint "
                 "tabTools pagePrint pageTools btnMkSnap btnMkMove btnViewMake tabTile pageTile "
                 "tbTSub btnTCols btnTBulk btnTSelect btnTClear btnTUpdate gridT pnlTEmpty "
                 "tbTEmptyText cardBulk btnTBulkApply pnlBulkRows txtTStatus btnTApply sideSets tabNm "
                 "pageNm tbNmTitle tbNmSub btnNmApply btnNmAddKw pnlNmKw tbNmKwEmpty tbNmTemplate "
                 "hNmTemplate pnlNmChips cbNmBase svNmList pnlNmList pnlNmEmpty tbNmEmptyText tbNmScope "
                 "tbNmScopeSub btnNmResetScope txtNStatus tabAnn pageAnn tbAnnSearch hAnnSearch lstAnnNav "
                 "btnAnnFromSel tbAnnSub cbAnnSrc svAnn pnlAnnGroups tbAnnEmpty cardAnnEdit tbAnnEditName "
                 "tbAnnEditFam tbAnnNote hAnnNote cbAnnCat btnAnnEditFav btnAnnEditWasd btnAnnEditSave btnAnnEditClose txtAnnStatus "
                 "cardAnnSel tbAnnSelText btnAnnSelAdd btnAnnSaveGroupSel cardAnnCreateGroup tbAnnNewGroupName btnAnnDoSaveGroup btnAnnCancelSaveGroup tabStrip btnCompact btnSide sideTools sideAnn "
                 "cardAnnMultiSel tbAnnMSelText btnAnnMSelFav btnAnnMSelSet btnAnnMSelClear "
                 "cardAnnSaveGroup tbAnnSaveGroupHint tbAnnGroupName hAnnGroupName btnAnnSaveGroup "
                 "btnAnnBar btnAnnSetNew cardAnnSet tbAnnSetTitle tbAnnSetName btnAnnSetDelete btnAnnSetSave pnlAnnEditSets "
                 "tbToolsStatus tbBrowserParams hBrowserParams "
                 "swMode swPanel swIcon swPanelIc swPanelTx swIconIc swIconTx tabHome pageHome island islandBody islandPill tbPillTab pillHover tbDocChip tbHomeDoc tbHomeSets tbHomeSel tbHomeStatus "
                 "homePrint homeNm homeTile homeAnn homeAnnBar homeSnap homeMove homeView "
                 "btnHdrAnnBar btnHdrView btnHdrMove btnHdrSnap icHdrAnnBar icHdrView popBrowser "
                 "tbHomeCtx tbHomeCtxSub pnlHomeCtx tbHomeRecentEmpty capHomeSets pnlHomeSets "
                 "capHomeSheets pnlHomeSheets capHomeAnns pnlHomeAnns tabMod pageMod pnlMods pnlModBar tbModStatus tbModHint tbModCount pillProgBox pillProgFill pillProgRow tbProgVerb tbProgVal pillProgBar").split()
        for n in names:
            setattr(self, n, self.win.FindName(n))

        # ---- cache (index) ----
        self.doc_title = None
        self._print_busy = False
        self._print_busy_at = 0.0
        self._print_timer = None
        self.meta_cache = {}      # id -> {id,label,num,name,kind,folders}
        self.sets = {}            # set name -> [id, ...]
        self.sel_ids = []         # selection in Revit (sorted)
        self.sel_set = set()
        self.dots = {}            # id -> TextBlock with a dot (updated without rebuilding the list)
        self.revs = {}            # revision id -> {seq,num,date,desc,by,to,issued}
        self.grp_items = {}       # header tag -> [ListBoxItem of the group's sheets]
        self.grp_ids = {}         # header tag -> (name, [sheet ids])
        self._sel_busy = False

        # ---- UI state ----
        self.cur_name = u""
        self.closed = False
        self._filling = False
        self.tab = 4
        self._rfill = False
        self.tools_busy = False
        self.tools_job = None
        self.sort_mode = 0
        self.orders = load_orders()
        self.settings = load_settings()
        self.ann_store = load_ann_store(self.settings)
        BROWSER_PARAMS[:] = [x for x in (self.settings.get("browser_params") or []) if isinstance(x, basestring)]
        self.btnSort.Content = u"Sorting: " + SORT_MODES[self.sort_mode][1]

        self.handler = Handler()
        self.handler.on_error = self.set_status
        self.ev = ExternalEvent.Create(self.handler)

        bind_hint(self.tbSetSearch, self.hSetSearch)
        bind_hint(self.tbNew, self.hNew)
        bind_hint(self.tbItemSearch, self.hItemSearch)
        self.items_dirty = False
        self.set_subs = {}
        self._set_timer = DispatcherTimer()
        self._set_timer.Interval = TimeSpan.FromMilliseconds(180)
        self._set_timer.Tick += lambda s, e: self.on_set_search_tick()
        self.tbSetSearch.TextChanged += lambda s, e: (self._set_timer.Stop(), self._set_timer.Start())
        self.tbItemSearch.TextChanged += lambda s, e: self.render_items()
        self.init_export_ui()

        self.dragA.MouseLeftButtonDown += self.on_drag
        self.dragB.MouseLeftButtonDown += self.on_drag
        # the "traffic light" buttons are inside dragA: we swallow Down, otherwise DragMove
        # captures the mouse and Up does not reach the button (that is why it did not close)
        self.btnClose.MouseLeftButtonDown += self.on_swallow
        self.btnPin.MouseLeftButtonDown += self.on_swallow
        self.btnClose.MouseLeftButtonUp += self.on_close
        self.btnPin.MouseLeftButtonUp += self.on_pin
        self.win.Closed += self.on_closed
        self.lstSets.SelectionChanged += self.on_set_picked
        self.lstItems.SelectionChanged += self.on_items_sel

        self.btnRefresh.Click += self.on_refresh
        self.btnCreate.Click += lambda s, e: self.run(self.do_create)
        self.btnAdd.Click += lambda s, e: self.run(self.do_add)
        self.btnReplace.Click += lambda s, e: self.run(self.do_replace)
        self.btnRemove.Click += self.on_remove
        self.btnSelRevit.Click += lambda s, e: self.run(self.do_select_in_revit)
        self.btnPrint.Click += lambda s, e: self.run(self.do_print, "print_dialog")
        self.btnPrintOrd.Click += self.on_print_ord
        self.btnPrintMore.Click += lambda s, e: setattr(self.popPrint, 'IsOpen', True)
        self.btnPrint.Click += lambda s, e: setattr(self.popPrint, 'IsOpen', False)
        self.btnSort.Click += self.on_sort
        self.btnMakeSets.Click += self.on_make_sets
        self.btnRevs.Click += self.on_revs
        self.btnDup.Click += self.on_dup
        self.btnRename.Click += self.on_rename
        self.btnDelete.Click += self.on_delete

        # on activation - only a light sync of the selection (without rebuilding the lists)
        self.win.Activated += self.on_activated
        self.win.Loaded += self.on_loaded
        self.isl_theme_start()
        self.tbNew.KeyUp += lambda s, e: (self.run(self.do_create) if str(e.Key) == "Return" else None)

        # ---- tabs ----
        self.tabHome.Checked += lambda s, e: self.show_tab(4)
        self.tabPrint.Checked += lambda s, e: self.show_tab(0)
        self.tabTools.Checked += lambda s, e: self.show_tab(1)
        if TK_ENABLE_TILE:
            self.tabTile.Checked += lambda s, e: self.show_tab(2)
        if TK_ENABLE_NM:
            self.tabNm.Checked += lambda s, e: self.show_tab(3)
        self.tabAnn.Checked += lambda s, e: self.show_tab(5)
        self.tabMod.Checked += lambda s, e: self.show_tab(6)
        tk_log(u'init: handlers bound')
        self.tile = {"loaded": True}
        self.nm = {"loaded": True}
        if TK_ENABLE_TILE:
            self.tile_setup()
            tk_log(u'init: tile_setup done')
        if TK_ENABLE_NM:
            self.nm_setup()
            tk_log(u'init: nm_setup done')
        self.ann_setup()
        tk_log(u'init: ann_setup done')
        self.compact_setup()
        tk_log(u'init: compact_setup done')
        # log and protection of the new tabs' handlers
        for name in ("tile_update", "on_tile_bulk_toggle", "on_tile_select", "on_tile_apply", "on_tile_bulk_apply",
                     "tile_clear", "on_nm_apply", "on_nm_edit", "on_nm_tick",
                     "nm_remove_kw", "nm_insert_token", "nm_select_scope", "nm_reset_scope", "nm_set_mode",
                     "nm_set_changed", "on_set_search_tick", "ann_render", "ann_place", "ann_toggle_fav", "ann_edit_open", "ann_edit_save",
                     "ann_edit_close", "ann_edit_fav", "ann_reload", "on_ann_nav", "on_ann_src",
                     "ann_prev_tick", "ann_poll_tick", "ann_update_banner",
                     "set_compact", "compact_apply_side", "compact_toggle_drawer", "compact_item_clicked",
                     "ann_bar_toggle", "ann_bar_open", "ann_bar_close", "ann_bar_closed", "ann_bar_drag",
                     "ann_bar_next_filter", "ann_bar_place_window", "ann_bar_refresh", "ann_bar_set_active",
                     "ann_bar_sync_add", "ann_bar_press", "ann_bar_scale",
                     "ann_set_new", "ann_set_save", "ann_set_delete", "ann_set_toggle", "ann_set_key",
                     "ann_set_panel_sync", "ann_bar_toggle_mode", "ann_bar_apply_mode", "ann_bar_float_pos"):
            setattr(self, name, tk_trace(getattr(self, name), self))
        setattr(self, "tile_dirty", tk_trace(self.tile_dirty, self, False))
        for name in ("do_tile_first", "do_tile_update", "do_tile_cols", "tile_apply_all", "tile_build", "tile_build_bulk",
                     "do_nm_first", "do_nm_load", "do_nm_addkw", "do_nm_apply", "nm_apply", "nm_load", "nm_build_list",
                     "do_ann_first", "do_ann_load", "do_ann_previews", "do_ann_place", "do_ann_from_sel", "do_ann_poll"):
            setattr(self, name, tk_trace(getattr(self, name)))
        self.tbBrowserParams.Text = u", ".join(BROWSER_PARAMS)
        bind_hint(self.tbBrowserParams, self.hBrowserParams)
        self.tbBrowserParams.TextChanged += self.tools_browser_changed
        self.btnMkSnap.Click += lambda s, e: self.tools_go("snapmarkers")
        self.btnMkMove.Click += lambda s, e: self.tools_go("movemarker")
        self.btnViewMake.Click += lambda s, e: self.tools_go("viewmaker")

        self.tkx_setup()
        self.update_state()
        tk_log(u'init: done')

    # ================= Print / export progress in the pill =================
    def ui_pump(self):
        """Let WPF redraw the window while the Revit thread is busy with a long call (print / export).
        Only Render priority and higher: clicks are not processed at this moment."""
        try:
            from System.Windows.Threading import DispatcherPriority
            from System import Action
            self.win.Dispatcher.Invoke(DispatcherPriority.Render, Action(lambda: None))
        except Exception:
            pass

    def prog_begin(self, total, verb=u"Print", pct=False, audit=False):
        """Print start: the island collapses into the pill, a counter and a bar appear in the pill.
        pct=True: the pill shows a percentage instead of done/total (the audit)."""
        try:
            self.prog_end()
            if getattr(self, "_mini", False) and not self.win.IsVisible:
                self._mini_prog = True                      # the progress is drawn in the pill: show it for the duration of the work
                self.win.Show()
            if self.isl.get("timer") is None and self._pill_info:
                self.pill_info_set(False, animate=False)
            p = {"total": max(1, int(total)), "done": 0, "verb": verb, "was_open": bool(self.isl["open"]),
                 "tab_text": self.tbPillTab.Text, "timer": None, "finished": False, "pct": bool(pct), "audit": bool(audit)}
            self._prog = p
            self.tbProgVerb.Text = verb
            self.tbProgVal.Text = u"0%" if pct else u"0/{}".format(p["total"])
            self.pillProgBar.RenderTransform.ScaleX = 0.0
            self.pillLeft.Visibility = Visibility.Collapsed
            self.pillRight.Visibility = Visibility.Collapsed
            self.pillProgRow.Visibility = Visibility.Visible
            if self.isl["open"]:
                self.island_set(False, save=False)
        except Exception as ex:
            tk_log(u"prog_begin: {}\n{}".format(ex, traceback.format_exc()))
            self._prog = None

    def prog_wait_collapse(self):
        """Wait for the end of the collapse animation while Revit has not yet blocked the thread with a long call."""
        try:
            t0 = time.time()
            while self.isl.get("timer") and time.time() - t0 < 0.6:
                self.ui_pump()
                time.sleep(0.012)
            self.ui_pump()
        except Exception:
            pass

    def prog_total(self, total, verb):
        p = getattr(self, "_prog", None)
        if not p:
            return
        p["total"] = max(1, int(total))
        p["verb"] = verb
        try:
            self.tbProgVerb.Text = verb
        except Exception:
            pass
        self.prog_update(0)

    def prog_update(self, done, what=None):
        p = getattr(self, "_prog", None)
        if not p or p.get("finished"):
            return
        try:
            p["done"] = done
            if p.get("pct"):
                self.tbProgVal.Text = u"{}%".format(int(100.0 * done / p["total"]))
            else:
                self.tbProgVal.Text = u"{}/{}".format(int(done), p["total"])
            self.pillProgBar.RenderTransform.ScaleX = max(0.0, min(1.0, float(done) / p["total"]))
            self.ui_pump()
        except Exception as ex:
            tk_log(u"prog_update: {}".format(ex))

    def prog_done(self, failed=False, text=None):
        """End of work: briefly show the result in the pill, then restore the appearance."""
        p = getattr(self, "_prog", None)
        if not p:
            return
        try:
            p["finished"] = True
            self.tbProgVal.Text = text or (u"Has errors" if failed else u"Done")
            self.pillProgBar.RenderTransform.ScaleX = 1.0
            self.ui_pump()
            t = DispatcherTimer()
            t.Interval = TimeSpan.FromMilliseconds(2200)

            def tick(s, e):
                t.Stop()
                self.prog_end()
            t.Tick += tick
            p["timer"] = t
            t.Start()
        except Exception as ex:
            tk_log(u"prog_done: {}".format(ex))
            self.prog_end()

    def prog_end(self):
        p = getattr(self, "_prog", None)
        if not p:
            return
        self._prog = None
        try:
            if p.get("timer") is not None:
                p["timer"].Stop()
            self.pillProgRow.Visibility = Visibility.Collapsed
            self.pillProgBar.RenderTransform.ScaleX = 0.0
            if not self._pill_info:
                self.pillLeft.Visibility = Visibility.Visible
                self.pillRight.Visibility = Visibility.Visible
            self.tbPillTab.Text = p["tab_text"]
            if p["was_open"] and not self.isl["open"]:
                self.island_set(True, save=False)
            if getattr(self, "_mini_prog", False):
                self._mini_prog = False
                if getattr(self, "_mini", False):
                    self.win.Hide()                          # back to the icon
        except Exception as ex:
            tk_log(u"prog_end: {}".format(ex))

    # ================= Dynamic Island: collapse / expand =================
    def island_setup(self):
        self._isl_h = lambda s, e: self.island_tick(s, e)
        self.isl = {"open": True, "p": 1.0, "p0": 1.0, "p1": 1.0, "t0": 0.0, "dur": 0.3, "timer": None}
        area = System.Windows.SystemParameters.WorkArea
        cx = float(self.settings.get("island_cx", area.Left + area.Width / 2.0))
        self.win.Left = cx - self.win.Width / 2.0
        self.win.Top = self.island_top()
        self.island_clamp()
        self.islandPill.MouseLeftButtonDown += self.on_pill_down
        self.pill_info_setup()
        self.islandPill.MouseEnter += lambda s, e: setattr(self.pillHover, "Opacity", 0.10)
        self.islandPill.MouseLeave += lambda s, e: setattr(self.pillHover, "Opacity", 0.0)
        self.btnCompact.MouseLeftButtonUp += lambda s, e: self.island_collapse()
        self.home_setup()
        if not self.settings.get("island_open", True):
            self.island_set(False, animate=False, save=False)
        self.mini_setup()

    # ================= Mini mode: a small icon in the Revit title bar (next to the account) =================
    def mini_setup(self):
        self._mini = False
        self._mini_win = None
        self._mini_el = None
        self._mini_drag = None
        self._mini_prog = False
        self._mini_timer = DispatcherTimer()
        self._mini_timer.Interval = TimeSpan.FromMilliseconds(400)
        self._mini_timer.Tick += lambda s, e: (self._mini_drag is None) and self.mini_place()
        for sg in (self.swPanel, self.swIcon):
            sg.MouseLeftButtonDown += self.on_swallow
        self.swPanel.MouseLeftButtonUp += lambda s, e: (setattr(e, "Handled", True), self.mini_switch(False))
        self.swIcon.MouseLeftButtonUp += lambda s, e: (setattr(e, "Handled", True), self.mini_switch(True))
        self.mini_sw_apply()
        self.islandPill.MouseRightButtonUp += lambda s, e: (setattr(e, "Handled", True), self.mini_set(True))
        try:
            self.islandPill.ToolTip = u"Expand Toolkit (right click: collapse to an icon)"
        except Exception:
            pass
        if self.settings.get("island_mini", True):        # default: collapsed to the icon
            self.mini_set(True, save=False)

    def mini_frame(self):
        """Visible frame of the Revit window in pixels + DPI scale + minimized flag."""
        import ctypes
        from ctypes import wintypes
        hwnd = ctypes.c_void_p(uiapp.MainWindowHandle.ToInt64())
        r = wintypes.RECT()
        # DWMWA_EXTENDED_FRAME_BOUNDS = 9: without the invisible resize borders of a maximized window
        if ctypes.windll.dwmapi.DwmGetWindowAttribute(hwnd, 9, ctypes.byref(r), ctypes.sizeof(r)) != 0:
            ctypes.windll.user32.GetWindowRect(hwnd, ctypes.byref(r))
        try:
            dpi = float(ctypes.windll.user32.GetDpiForWindow(hwnd)) / 96.0
            if dpi <= 0.0:
                dpi = 1.0
        except Exception:
            dpi = 1.0
        return r, dpi, bool(ctypes.windll.user32.IsIconic(hwnd))

    def mini_cursor_x(self):
        import ctypes
        from ctypes import wintypes
        pt = wintypes.POINT()
        ctypes.windll.user32.GetCursorPos(ctypes.byref(pt))
        return int(pt.x)

    def mini_place(self, dx=None):
        w = self._mini_win
        if w is None:
            return
        try:
            import ctypes
            hm = WindowInteropHelper(w).Handle.ToInt64()
            if not hm:
                return
            r, dpi, iconic = self.mini_frame()
            if iconic:
                return
            if dx is None:
                dx = float(self.settings.get("mini_dx", MINI_DX_DEF))
            sz = int(round(MINI_SZ * dpi))
            x = int(r.right) - int(round(dx * dpi)) - sz
            y = int(r.top) + int(round(MINI_TOP * dpi))
            ctypes.windll.user32.SetWindowPos(ctypes.c_void_p(hm), None, x, y, sz, sz, 0x0214)
        except Exception as ex:
            tk_log(u"mini_place: {}".format(ex))

    def mini_show(self):
        import ctypes
        if self._mini_win is None:
            w = XamlReader.Parse(MINI_XAML)
            try:
                WindowInteropHelper(w).Owner = uiapp.MainWindowHandle     # hides / restores together with Revit
            except Exception as ex:
                tk_log(u"mini owner: {}".format(ex))
            mi = w.FindName("mi")
            mi.MouseLeftButtonDown += self.mini_down
            mi.MouseMove += self.mini_move
            mi.MouseLeftButtonUp += self.mini_up
            mi.MouseRightButtonUp += lambda s, e: (setattr(e, "Handled", True), self.mini_set(False, save=True))   # switch to the panel mode
            mi.MouseEnter += lambda s, e: setattr(s, "Opacity", 0.85)
            mi.MouseLeave += lambda s, e: setattr(s, "Opacity", 1.0)
            self._mini_win, self._mini_el = w, mi
        w = self._mini_win
        w.Show()
        try:
            hm = ctypes.c_void_p(WindowInteropHelper(w).Handle.ToInt64())
            GWL_EXSTYLE = -20
            ex = ctypes.windll.user32.GetWindowLongW(hm, GWL_EXSTYLE)
            # NOACTIVATE: a click on the icon does not take the focus from Revit; TOOLWINDOW: not in Alt+Tab
            ctypes.windll.user32.SetWindowLongW(hm, GWL_EXSTYLE, ex | 0x08000000 | 0x00000080)
        except Exception as ex2:
            tk_log(u"mini exstyle: {}".format(ex2))
        self.mini_place()
        self._mini_timer.Start()

    def mini_hide(self):
        try:
            self._mini_timer.Stop()
        except Exception:
            pass
        try:
            if self._mini_win is not None:
                self._mini_win.Hide()
        except Exception:
            pass

    def mini_set(self, on, save=True):
        on = bool(on)
        mini_vis = self._mini_win is not None and self._mini_win.IsVisible
        if on and self._mini and mini_vis and not self.win.IsVisible:
            return                                   # already collapsed to the icon
        if not on and not self._mini and not mini_vis:
            return                                   # already a normal panel
        self._mini = on
        if save:
            self.settings["island_mini"] = on
            save_settings(self.settings)
            self.mini_sw_apply()
        if on:
            self.pill_info_set(False, animate=False)
            self.island_set(False, animate=False, save=False)     # in the background the island stays a pill
            self.win.Hide()
            self.mini_show()
        else:
            self.mini_hide()
            self.win.Show()
            self.island_set(True)                                  # a click on the icon opens the panel

    def island_collapse(self):
        """Collapse button: into the icon or into the panel bar - as the Panel / Icon switch says."""
        if self.settings.get("island_mini", True):
            self.mini_set(True, save=False)
        else:
            self.island_set(False)

    def mini_sw_apply(self):
        """Panel | Icon switch in the header: the lime segment is the form the collapsed Toolkit takes."""
        try:
            on = bool(self.settings.get("island_mini", True))
            lime, off = ann_brush(u"#0071E3"), isl_brush(u"#98989D")
            blk = ann_brush(u"#FFFFFF")
            self.swIcon.Background = lime if on else isl_brush(u"#00000000")
            self.swPanel.Background = isl_brush(u"#00000000") if on else lime
            for el in (self.swIconIc, self.swIconTx):
                el.Foreground = blk if on else off
            for el in (self.swPanelIc, self.swPanelTx):
                el.Foreground = off if on else blk
        except Exception as ex:
            tk_log(u"mini_sw_apply: {}".format(ex))

    def mini_switch(self, to_icon):
        """Only chooses the collapsed form (saved); nothing collapses until the collapse button is pressed."""
        to_icon = bool(to_icon)
        if to_icon == bool(self.settings.get("island_mini", True)):
            return
        self.settings["island_mini"] = to_icon
        save_settings(self.settings)
        self.mini_sw_apply()

    def mini_down(self, s, e):
        e.Handled = True
        try:
            r, dpi, _ = self.mini_frame()
            self._mini_drag = {"x0": self.mini_cursor_x(), "moved": False, "dpi": dpi,
                               "dx0": float(self.settings.get("mini_dx", MINI_DX_DEF)),
                               "max": max(60.0, float(r.right - r.left) / dpi - 260.0)}
            s.CaptureMouse()
        except Exception as ex:
            self._mini_drag = None
            tk_log(u"mini_down: {}".format(ex))

    def mini_move(self, s, e):
        d = self._mini_drag
        if d is None:
            return
        try:
            mx = self.mini_cursor_x() - d["x0"]
            if abs(mx) > 4:
                d["moved"] = True
            if d["moved"]:
                d["dx"] = max(30.0, min(d["dx0"] - mx / d["dpi"], d["max"]))
                self.mini_place(d["dx"])
        except Exception as ex:
            tk_log(u"mini_move: {}".format(ex))

    def mini_up(self, s, e):
        e.Handled = True
        d, self._mini_drag = self._mini_drag, None
        try:
            s.ReleaseMouseCapture()
        except Exception:
            pass
        if d is None:
            return
        if d["moved"]:
            if "dx" in d:
                self.settings["mini_dx"] = d["dx"]                # remembered: the distance from the right edge of Revit
                save_settings(self.settings)
        else:
            self.mini_set(False, save=False)          # temporary: the saved mode stays, collapsing returns to it

    # ---------- "i" mode: the Revit window title in the expanded pill ----------
    def pill_info_setup(self):
        w = self.win
        self.pillLeft, self.pillRight = w.FindName("pillLeft"), w.FindName("pillRight")
        self.pillInfo, self.pillInfoBack = w.FindName("pillInfo"), w.FindName("pillInfoBack")
        self.pillInfoRow, self.pillTitle = w.FindName("pillInfoRow"), w.FindName("pillTitle")
        self._pill_info, self._pill_tok = False, 0
        self._pill_timer = DispatcherTimer()
        self._pill_timer.Interval = TimeSpan.FromMilliseconds(700)
        self._pill_timer.Tick += lambda s, e: self.pill_info_tick()
        self.pillInfo.MouseLeftButtonDown += self.on_swallow
        self.pillInfo.MouseLeftButtonUp += lambda s, e: (setattr(e, "Handled", True), self.pill_info_set(True))
        self.pillInfoBack.MouseLeftButtonDown += self.on_swallow
        self.pillInfoBack.MouseLeftButtonUp += lambda s, e: (setattr(e, "Handled", True), self.pill_info_set(False))

    def pill_title_text(self):
        """The Revit window title (what the island covers in the title bar)."""
        try:
            import ctypes
            buf = ctypes.create_unicode_buffer(1024)
            ctypes.windll.user32.GetWindowTextW(ctypes.c_void_p(uiapp.MainWindowHandle.ToInt64()), buf, 1024)
            if buf.value:
                return buf.value
        except Exception as ex:
            tk_log(u"pill title: {}".format(ex))
        try:
            return uiapp.MainWindowCaption or u""
        except Exception:
            return u""

    def pill_info_width(self):
        tb = self.pillTitle
        tb.Text = self.pill_title_text()
        tb.Measure(System.Windows.Size(float("inf"), float("inf")))
        area = System.Windows.SystemParameters.WorkArea
        w = float(tb.DesiredSize.Width) + 4.0                 # DesiredSize already includes the text margins
        return max(ISL_PILL_W, min(w, float(area.Width) - 2 * ISL_PAD - 24.0))

    def pill_info_resize(self, w, animate=True):
        """Smoothly change the pill width to w (the window - at once to the larger of the two widths, so the window edge does not cut the animation)."""
        isl = self.island
        self._pill_tok += 1
        tok = self._pill_tok
        cx = self.win.Left + self.win.Width / 2.0
        cur = float(isl.Width)
        big = max(w, cur)
        self.island_win(big + 2 * ISL_PAD, ISL_PILL_H + ISL_PAD, cx)

        def fin(s=None, e=None):
            if tok != self._pill_tok:
                return
            try:
                isl.BeginAnimation(FrameworkElement.WidthProperty, None)
                isl.Width = w
                if w < big:
                    self.island_win(w + 2 * ISL_PAD, ISL_PILL_H + ISL_PAD)
            except Exception as ex:
                tk_log(u"pill info fin: {}".format(ex))
        if not animate or abs(w - cur) < 1.0:
            fin()
            return
        try:
            da = AnDouble()
            da.From = cur
            da.To = float(w)
            da.Duration = System.Windows.Duration(TimeSpan.FromMilliseconds(220))
            ease = AnCubic()
            ease.EasingMode = AnEasing.EaseOut
            da.EasingFunction = ease
            da.Completed += fin
            isl.BeginAnimation(FrameworkElement.WidthProperty, da)
        except Exception as ex:
            tk_log(u"pill info anim: {}".format(ex))
            fin()

    def pill_info_set(self, on, animate=True):
        on = bool(on)
        if on and (self.isl["open"] or self.isl.get("timer")):
            return                                           # "i" mode - only for the collapsed pill
        if on == self._pill_info:
            return
        self._pill_info = on
        vis, hid = Visibility.Visible, Visibility.Collapsed
        self.pillLeft.Visibility = hid if on else vis
        self.pillRight.Visibility = hid if on else vis
        self.pillInfoRow.Visibility = vis if on else hid
        if on:
            self.pill_info_resize(self.pill_info_width(), animate)
            self._pill_timer.Start()
        else:
            self._pill_timer.Stop()
            self.pill_info_resize(ISL_PILL_W, animate)

    def pill_info_tick(self):
        """The window title changes when another view/project is opened - we update the text and width."""
        try:
            if not self._pill_info:
                self._pill_timer.Stop()
                return
            if self.pill_title_text() != self.pillTitle.Text:
                self.pill_info_resize(self.pill_info_width(), True)
        except Exception as ex:
            tk_log(u"pill info tick: {}".format(ex))

    def island_top(self):
        # the "notch" is always glued to the top of the screen work area
        try:
            return float(System.Windows.SystemParameters.WorkArea.Top)
        except Exception:
            return 0.0

    def island_clamp(self):
        try:
            sp = System.Windows.SystemParameters
            lo = sp.VirtualScreenLeft - ISL_PAD + 4.0
            hi = sp.VirtualScreenLeft + sp.VirtualScreenWidth - self.win.Width + ISL_PAD - 4.0
            self.win.Left = max(lo, min(self.win.Left, hi))
            self.win.Top = self.island_top()
        except Exception:
            pass

    def win_set_rect(self, left, top, w, h):
        """Move AND resize the window in ONE SetWindowPos call (everything in DIP).
        Three separate Width/Height/Left assignments give an intermediate frame: the window is already narrow, but still stands at the old Left -
        the pill briefly appears at the side."""
        try:
            import ctypes
            win = self.win
            hwnd = WindowInteropHelper(win).Handle.ToInt64()
            src = System.Windows.PresentationSource.FromVisual(win)
            if not hwnd or src is None:
                return False
            m = src.CompositionTarget.TransformToDevice
            sx, sy = float(m.M11), float(m.M22)
            ok = ctypes.windll.user32.SetWindowPos(
                ctypes.c_void_p(hwnd), None,
                int(round(left * sx)), int(round(top * sy)), int(round(w * sx)), int(round(h * sy)),
                0x0214)          # SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOOWNERZORDER
            return bool(ok)
        except Exception as ex:
            tk_log(u"win_set_rect: {}".format(ex))
            return False

    def island_win(self, w, h, cx=None):
        win = self.win
        if cx is None:
            cx = win.Left + win.Width / 2.0
        try:
            sp = System.Windows.SystemParameters
            lo = sp.VirtualScreenLeft - ISL_PAD + 4.0
            hi = sp.VirtualScreenLeft + sp.VirtualScreenWidth - w + ISL_PAD - 4.0
            left = max(lo, min(cx - w / 2.0, hi))
        except Exception:
            left = cx - w / 2.0
        if self.win_set_rect(left, self.island_top(), w, h):
            try:
                win.UpdateLayout()       # layout right away for the new size - without a frame with the old one
            except Exception:
                pass
            return
        win.Width = w                    # fallback path (the window has no HWND yet)
        win.Height = h
        win.Left = left
        self.island_clamp()

    def island_save_pos(self):
        try:
            self.settings["island_cx"] = self.win.Left + self.win.Width / 2.0
            save_settings(self.settings)
        except Exception:
            pass

    def island_apply(self, p):
        """p = 0 -> pill, p = 1 -> expanded island (may slightly exceed 1 on the spring)."""
        self.isl["p"] = p
        pc = max(0.0, min(1.0, p))
        w = ISL_PILL_W + (ISL_EXP_W - ISL_PILL_W) * p
        h = ISL_PILL_H + (ISL_EXP_H - ISL_PILL_H) * p
        w = max(ISL_PILL_W, min(w, ISL_EXP_W + ISL_PAD - 4.0))
        h = max(ISL_PILL_H, min(h, ISL_EXP_H + ISL_PAD - 4.0))
        self.island.Width = w
        self.island.Height = h
        self.island.CornerRadius = CornerRadius(0.0, 0.0, min(36.0, h / 2.0), min(36.0, h / 2.0))
        self.islandBody.Opacity = max(0.0, min(1.0, (pc - 0.30) / 0.70))
        self.islandPill.Opacity = max(0.0, min(1.0, 1.0 - pc / 0.30))
        self.islandBody.Visibility = Visibility.Visible if pc > 0.01 else Visibility.Collapsed
        self.islandPill.Visibility = Visibility.Visible if pc < 0.99 else Visibility.Collapsed
        self.islandBody.IsHitTestVisible = pc > 0.95

    def island_stop(self):
        """Stop the animation: unsubscribe from render frames and remove the cache raster from the content."""
        isl = self.isl
        if isl.get("timer") is not None:
            try:
                CompositionTarget.Rendering -= self._isl_h
            except Exception:
                pass
            isl["timer"] = None
        try:
            self.islandBody.CacheMode = None
        except Exception:
            pass

    def island_set(self, open_, animate=True, save=True):
        isl = self.isl
        self.island_stop()
        if open_:
            self.pill_info_set(False, animate=False)
        cx = self.win.Left + self.win.Width / 2.0
        if open_:
            self.island_win(ISL_EXP_W + 2 * ISL_PAD, ISL_EXP_H + ISL_PAD, cx)
        isl["open"] = bool(open_)
        if save:
            self.settings["island_open"] = bool(open_)
            save_settings(self.settings)
        target = 1.0 if open_ else 0.0
        if not animate:
            self.island_apply(target)
            if not open_:
                self.island_win(ISL_PILL_W + 2 * ISL_PAD, ISL_PILL_H + ISL_PAD, cx)
            return
        isl["p0"], isl["p1"] = isl["p"], target
        isl["t0"] = time.time()
        isl["dur"] = 0.40 if open_ else 0.26
        # The island content is rasterized once during the animation (the GPU only scales/fades the image),
        # and the steps are computed in time with the WPF frames (CompositionTarget.Rendering): a 14 ms DispatcherTimer
        # fires unevenly, which is why everything "lagged".
        try:
            self.islandBody.CacheMode = BitmapCache()
        except Exception:
            pass
        isl["timer"] = True
        CompositionTarget.Rendering += self._isl_h

    def island_tick(self, s, e):
        isl = self.isl
        try:
            t = (time.time() - isl["t0"]) / isl["dur"]
            done = t >= 1.0
            t = min(1.0, t)
            if isl["p1"] > isl["p0"]:
                c1 = 0.7                      # expand: a spring with a slight overshoot
                k = 1.0 + (c1 + 1.0) * (t - 1.0) ** 3 + c1 * (t - 1.0) ** 2
            else:                             # collapse: smooth in-out
                k = 4.0 * t * t * t if t < 0.5 else 1.0 - ((-2.0 * t + 2.0) ** 3) / 2.0
            self.island_apply(isl["p0"] + (isl["p1"] - isl["p0"]) * k)
            if done:
                self.island_stop()
                self.island_apply(isl["p1"])
                if isl["p1"] <= 0.0:
                    self.island_win(ISL_PILL_W + 2 * ISL_PAD, ISL_PILL_H + ISL_PAD)
                self.island_save_pos()
        except Exception as ex:
            self.island_stop()
            tk_log(u"island_tick: {}".format(ex))

    def on_pill_down(self, s, e):
        # a click on the pill expands the island, dragging just moves it
        l0, t0 = self.win.Left, self.win.Top
        try:
            self.win.DragMove()
        except Exception:
            pass
        self.win.Top = self.island_top()
        if abs(self.win.Left - l0) < 4 and abs(self.win.Top - t0) < 4:
            self.island_set(True)
        else:
            self.island_save_pos()

    # ================= Home: all functions on one screen =================
    def home_setup(self):
        def go(tab):
            return lambda s, e: setattr(tab, "IsChecked", True)
        self.homePrint.Click += go(self.tabPrint)
        self.homeNm.Click += go(self.tabNm)
        self.homeTile.Click += go(self.tabTile)
        self.homeAnn.Click += go(self.tabAnn)
        self.homeAnnBar.Click += lambda s, e: self.ann_bar_toggle()
        # tool icons in the header (click - action, no window dragging)
        for _b in (self.btnHdrAnnBar, self.btnHdrView, self.btnHdrMove, self.btnHdrSnap):
            _b.MouseLeftButtonDown += self.on_swallow
        self.btnHdrAnnBar.MouseLeftButtonUp += lambda s, e: (setattr(e, "Handled", True), self.ann_bar_toggle())
        self.btnHdrView.MouseLeftButtonUp += lambda s, e: (setattr(e, "Handled", True), self.hdr_view_toggle())
        self.btnHdrView.MouseRightButtonUp += lambda s, e: (setattr(e, "Handled", True), setattr(self.popBrowser, "IsOpen", True))
        self.btnHdrMove.MouseLeftButtonUp += lambda s, e: (setattr(e, "Handled", True), self.tools_go("movemarker"))
        self.btnHdrSnap.MouseLeftButtonUp += lambda s, e: (setattr(e, "Handled", True), self.tools_go("snapmarkers"))
        self.homeSnap.Click += lambda s, e: self.tools_go("snapmarkers")
        self.homeMove.Click += lambda s, e: self.tools_go("movemarker")
        self.homeView.Click += lambda s, e: self.tools_go("viewmaker")

    def home_refresh(self):
        try:
            title = self.doc_title
            self.tbDocChip.Text = title if title else u"Revit"
            self.tbHomeDoc.Text = title if title else u"No project connected"
            self.tbHomeSets.Text = unicode(len(self.sets))
            self.tbHomeSel.Text = unicode(len(self.sel_ids))
        except Exception:
            pass
        try:
            self.home_ctx_render()
            self.home_recent_render()
            self.tkx_home_render()
        except Exception as ex:
            tk_log(u"home render: {}".format(ex))

    # ---------- Home: "Now" (actions for the selection) and "Continue" (recent) ----------
    def home_chip(self, text, glyph, action, tip=None, accent=False, max_w=230.0):
        bg = u"#0071E3" if accent else u"#1C1C1E"
        hv = u"#2997FF" if accent else u"#2C2C2E"
        fg = ann_brush(u"#FFFFFF") if accent else isl_brush(u"#F5F5F7")
        bd = Border()
        bd.CornerRadius = CornerRadius(17)
        bd.Height = 34.0
        icon_only = bool(glyph) and not text          # empty text -> a compact icon-only chip (the tip explains it)
        bd.Padding = Thickness(11, 0, 11, 0) if icon_only else Thickness(14, 0, 14, 0)
        bd.Margin = Thickness(0, 0, 8, 8)
        bd.Cursor = AnnCursors.Hand
        bd.Background = isl_brush(bg)
        if tip:
            bd.ToolTip = tip
        sp = StackPanel()
        sp.Orientation = Orientation.Horizontal
        if glyph:
            ic = TextBlock()
            ic.Text = glyph
            ic.FontFamily = ICON_FONT
            ic.FontSize = 13.0
            ic.Foreground = fg
            ic.VerticalAlignment = VerticalAlignment.Center
            ic.Margin = Thickness(0, 0, 0 if icon_only else 8, 0)
            sp.Children.Add(ic)
        tb = TextBlock()
        tb.Text = text
        tb.Foreground = fg
        tb.FontWeight = FontWeights.SemiBold
        tb.VerticalAlignment = VerticalAlignment.Center
        tb.MaxWidth = max_w
        tb.TextTrimming = TextTrimming.CharacterEllipsis
        if not icon_only:
            sp.Children.Add(tb)
        bd.Child = sp
        bd.MouseEnter += lambda s, e: setattr(bd, "Background", isl_brush(hv))
        bd.MouseLeave += lambda s, e: setattr(bd, "Background", isl_brush(bg))
        bd.MouseLeftButtonUp += lambda s, e: (setattr(e, "Handled", True), action())
        return bd

    def recent_add(self, kind, item, limit=8):
        try:
            r = self.settings.setdefault("recent", {})
            lst = list(r.get(kind, []))
            ident = (lambda x: x.get("uid") if isinstance(x, dict) else x)
            if lst and ident(lst[0]) == ident(item):
                if lst[0] == item:
                    return
            lst = [x for x in lst if ident(x) != ident(item)]
            lst.insert(0, item)
            r[kind] = lst[:limit]
            save_settings(self.settings)
            if self.tab == 4:
                self.home_recent_render()
        except Exception as ex:
            tk_log(u"recent_add: {}".format(ex))

    def home_tick(self):
        if self.closed or self.tools_busy:
            return
        self._home_n += 1
        if self.tab != 4 and self._home_n % 3:       # outside Home only light tracking of the open sheet
            return
        self.run(self.do_home_poll, "homepoll")

    def do_home_poll(self, uiapp):
        uidoc = uiapp.ActiveUIDocument
        if uidoc is None or self.closed:
            return
        doc = uidoc.Document
        view = doc.ActiveView
        try:
            if isinstance(view, ViewSheet):
                self.recent_add("sheets", {"doc": doc.Title, "uid": view.UniqueId,
                                           "label": u"{} \u00B7 {}".format(view.SheetNumber, view.Name)})
        except Exception as ex:
            tk_log(u"home sheet: {}".format(ex))
        if self.tab != 4:
            return
        ids = list(uidoc.Selection.GetElementIds())
        sig = (tuple(sorted(id_value(i) for i in ids)), tuple(self.sel_ids), id_value(view.Id) if view else -1,
               doc.Title, bool(self.ann.get("loaded")))
        if sig == getattr(self, "_home_sig", None):
            return
        self._home_sig = sig
        mk = an = md = 0
        for eid in ids[:300]:
            el = doc.GetElement(eid)
            if el is None:
                continue
            if isinstance(el, DB.ElevationMarker) or (isinstance(el, DB.ViewSection) and el.ViewType == ViewType.Elevation):
                mk += 1
                continue
            if isinstance(el, (DB.View, DB.Viewport)):
                continue
            try:
                is_ann = ann_symbol_of(doc, el, True) is not None
            except Exception:
                is_ann = False
            if not is_ann:
                cat = getattr(el, "Category", None)
                is_ann = cat is not None and (cat.CategoryType == AnnCategoryType.Annotation or
                                              isinstance(el, (Dimension, TextNote, IndependentTag)))
            if is_ann:
                an += 1
            else:
                md += 1
        self.home_ctx = {"mk": mk, "an": an, "md": md, "view": view.Name if view is not None else u""}
        self.home_ctx_render()

    def home_view_open(self):
        if _VM[0] is None:
            self.tools_go("viewmaker")
        elif bar_state() in (u"ann", None):
            bar_toggle(u"vm")

    def home_bar_open(self):
        if self.bar.get("win") is None:
            self.ann_bar_open()
        elif self.bar.get("hidden"):
            bar_toggle(u"ann")

    def home_open_set(self, name):
        if name not in self.sets:
            return
        self.cur_name = name
        self.items_dirty = True
        self.tabPrint.IsChecked = True
        try:
            self.render_sets()
        except Exception as ex:
            tk_log(u"home open set: {}".format(ex))

    def home_open_sheet(self, uid):
        self.run(lambda uiapp, u=uid: self.do_open_sheet(uiapp, u), "opensheet")

    def do_open_sheet(self, uiapp, uid):
        uidoc = uiapp.ActiveUIDocument
        el = uidoc.Document.GetElement(uid) if uidoc is not None else None
        if el is None:
            self.set_status(u"The sheet was not found in this project.")
            return
        uidoc.RequestViewChange(el)

    def home_place_ann(self, key):
        if key in self.ann["by"]:
            self.ann_place(key)
        else:
            self.tabAnn.IsChecked = True           # the annotation library is not loaded yet: opening the tab
            self.hdr_toast(u"Loading annotations - click again on Home")

    def home_ctx_render(self):
        c = getattr(self, "home_ctx", None) or {"mk": 0, "an": 0, "md": 0, "view": u""}
        if self.pnlHomeCtx is None:
            return
        p = self.pnlHomeCtx
        p.Children.Clear()
        mk, an, md, nb = c["mk"], c["an"], c["md"], len(self.sel_ids)
        parts = []
        if mk:
            parts.append(u"Elevation markers: {}".format(mk))
        if an:
            parts.append(u"Annotations: {}".format(an))
        if md:
            parts.append(u"Model elements: {}".format(md))
        if nb:
            parts.append(u"Views in Browser: {}".format(nb))
        if not parts:
            self.tbHomeCtx.Text = u"Nothing selected"
            self.tbHomeCtxSub.Text = u"Select elements in a view or views in Project Browser - suitable actions will appear here."
            return
        self.tbHomeCtx.Text = u"  \u00B7  ".join(parts)
        self.tbHomeCtxSub.Text = (u"View: " + c["view"]) if c.get("view") else u""
        if mk:
            p.Children.Add(self.home_chip(u"Align markers", u"\uE7AD", lambda: self.tools_go("snapmarkers"), accent=True))
            p.Children.Add(self.home_chip(u"Move marker", u"\uE7C2", lambda: self.tools_go("movemarker")))
        if md:
            p.Children.Add(self.home_chip(u"View \u2192 Sheet", u"\uE722", self.home_view_open, accent=(not mk)))
        if an:
            p.Children.Add(self.home_chip(u"To favorites", u"\uE735", lambda: self.run(self.do_ann_from_sel, "annsel"),
                                          u"Add the type of the selected annotation to favorites", accent=True))
            p.Children.Add(self.home_chip(u"Annotations strip", u"\uE8A7", self.home_bar_open))
        if nb:
            p.Children.Add(self.home_chip(u"Print Set from {} views".format(nb), u"\uE749",
                                          lambda: setattr(self.tabPrint, "IsChecked", True)))

    def home_recent_render(self):
        if self.pnlHomeSets is None:
            return
        r = self.settings.get("recent", {}) if isinstance(self.settings, dict) else {}
        title = self.doc_title
        sets = [n for n in r.get("sets", []) if n in self.sets][:4]
        sheets = [x for x in r.get("sheets", []) if isinstance(x, dict) and x.get("doc") == title][:4]
        anns = list(r.get("anns", []))[:4]
        groups = ((self.capHomeSets, self.pnlHomeSets, sets), (self.capHomeSheets, self.pnlHomeSheets, sheets),
                  (self.capHomeAnns, self.pnlHomeAnns, anns))
        for cap, pnl, items in groups:
            pnl.Children.Clear()
            vis = Visibility.Visible if items else Visibility.Collapsed
            cap.Visibility = vis
            pnl.Visibility = vis
        for n in sets:
            self.pnlHomeSets.Children.Add(self.home_chip(n, u"\uE749", lambda nm=n: self.home_open_set(nm),
                                                         u"Open the set in Print Sets"))
        for x in sheets:
            self.pnlHomeSheets.Children.Add(self.home_chip(x.get("label", u"Sheet"), u"\uE7C3",
                                                           lambda u=x.get("uid"): self.home_open_sheet(u),
                                                           u"Go to this sheet in Revit"))
        for k in anns:
            fam, typ = ann_split_key(k)
            self.pnlHomeAnns.Children.Add(self.home_chip(typ or k, u"\uE8EC", lambda kk=k: self.home_place_ann(kk),
                                                         u"{} \u00B7 {}\nPlace again".format(fam, typ)))
        self.tbHomeRecentEmpty.Visibility = Visibility.Collapsed if (sets or sheets or anns) else Visibility.Visible

    # ================= Modules (custom .py scripts) =================
    MOD_TEMPLATE = u"""# desc: Module template - shows how many elements are selected
# Available variables: uiapp, uidoc, doc, TOOLKIT (the toolkit window).
# The code runs inside the Revit API context; transactions are on your side.
from Autodesk.Revit.DB import Transaction

sel = list(uidoc.Selection.GetElementIds())
TOOLKIT.set_status(u"Elements selected: {}".format(len(sel)))
"""

    def mod_dir(self):
        d = os.path.join(os.path.dirname(DATA), 'modules')
        if not os.path.isdir(d):
            os.makedirs(d)
        if d not in sys.path:
            sys.path.append(d)      # modules can import each other
        return d

    def mod_desc(self, path):
        try:
            with codecs.open(path, 'r', 'utf-8-sig') as f:
                head = f.read(1500)
            m = re.search(u'(?mi)^#\\s*(?:desc|\u043e\u043f\u0438\u0441)\\s*:\\s*(.+?)\\s*$', head)
            return m.group(1) if m else u""
        except Exception:
            return u""

    MOD_COLORS = (u"#0A84FF", u"#34C759", u"#FF9F0A", u"#FF375F", u"#BF5AF2", u"#5856D6", u"#30B0C7")

    def mod_set(self, el, prop, h, fg=False):
        """Brush via DynamicResource: the theme switches live, without recoloring from Python.
        Colors outside the theme palette (lime, white, red) stay static."""
        hu = h.upper()
        if fg and hu in TK_LIGHT_FG:
            el.SetResourceReference(prop, isl_key(hu, True))
        elif hu in TK_LIGHT_MAP:
            el.SetResourceReference(prop, isl_key(hu))
        else:
            el.SetValue(prop, ann_brush(hu))

    def mod_pill(self, text, glyph, action, tip=None, kind=u"sec", full=False):
        """Pill: pri = lime, sec = neutral, danger = delete."""
        from System.Windows import HorizontalAlignment as HA
        bg, hv, fg = {u"pri": (u"#0071E3", u"#2997FF", u"#FFFFFF"),
                      u"sec": (u"#1C1C1E", u"#2C2C2E", u"#F5F5F7"),
                      u"danger": (u"#1C1C1E", u"#2C2C2E", u"#FF453A")}[kind]
        bd = Border()
        bd.CornerRadius = CornerRadius(17)
        bd.Height = 34.0
        bd.Cursor = AnnCursors.Hand
        self.mod_set(bd, Border.BackgroundProperty, bg)
        if text:
            bd.Padding = Thickness(14, 0, 14, 0)
        else:
            bd.Width = 34.0
        if full:
            bd.Margin = Thickness(0, 0, 0, 8)
        if tip:
            bd.ToolTip = tip
        sp = StackPanel()
        sp.Orientation = Orientation.Horizontal
        sp.HorizontalAlignment = HA.Center
        sp.VerticalAlignment = VerticalAlignment.Center
        if glyph:
            ic = TextBlock()
            ic.Text = glyph
            ic.FontFamily = ICON_FONT
            ic.FontSize = 13.0
            self.mod_set(ic, TextBlock.ForegroundProperty, fg)
            ic.VerticalAlignment = VerticalAlignment.Center
            if text:
                ic.Margin = Thickness(0, 0, 8, 0)
            sp.Children.Add(ic)
        if text:
            tb = TextBlock()
            tb.Text = text
            tb.FontWeight = FontWeights.SemiBold
            self.mod_set(tb, TextBlock.ForegroundProperty, fg)
            tb.VerticalAlignment = VerticalAlignment.Center
            sp.Children.Add(tb)
        bd.Child = sp
        bd.MouseEnter += lambda s, e: self.mod_set(bd, Border.BackgroundProperty, hv)
        bd.MouseLeave += lambda s, e: self.mod_set(bd, Border.BackgroundProperty, bg)
        bd.MouseLeftButtonUp += lambda s, e: (setattr(e, "Handled", True), action())
        return bd

    def mod_bar_build(self):
        if getattr(self, "_mod_bar", False):
            return
        self._mod_bar = True
        self.pnlModBar.Children.Add(self.mod_pill(u"Add .py", u"\uE710", self.mod_add,
                                                  u"Copy scripts to the modules folder", u"pri", True))
        self.pnlModBar.Children.Add(self.mod_pill(u"New from template", u"\uE8A5", self.mod_new,
                                                  u"Create a module from the template and open it in the editor", u"sec", True))
        self.pnlModBar.Children.Add(self.mod_pill(u"Open folder", u"\uE838", self.mod_open_dir,
                                                  u"Show the modules folder in Explorer", u"sec", True))

    def mod_refresh(self):
        try:
            self.mod_bar_build()
            d = self.mod_dir()
            self.tbModHint.Text = d
            files = sorted((f for f in os.listdir(d) if f.lower().endswith(u".py") and not f.startswith(u"_")),
                           key=lambda x: x.lower())
            self.tbModCount.Text = str(len(files))
            self.pnlMods.Children.Clear()
            if not files:
                self.pnlMods.Children.Add(self.mod_empty())
                return
            for f in files:
                self.pnlMods.Children.Add(self.mod_card(os.path.join(d, f), f))
        except Exception as ex:
            tk_log(u"mod_refresh: {}\n{}".format(ex, traceback.format_exc()))
            self.set_status(u"Modules: {}".format(err_text(ex)))

    def mod_empty(self):
        from System.Windows import HorizontalAlignment as HA, TextAlignment
        sp = StackPanel()
        sp.HorizontalAlignment = HA.Center
        sp.Margin = Thickness(0, 90, 0, 0)
        ic = Border()
        ic.Width = 72.0
        ic.Height = 72.0
        ic.CornerRadius = CornerRadius(22)
        self.mod_set(ic, Border.BackgroundProperty, u"#1C1C1E")
        ic.HorizontalAlignment = HA.Center
        g = TextBlock()
        g.Text = u"\uE943"
        g.FontFamily = ICON_FONT
        g.FontSize = 30.0
        self.mod_set(g, TextBlock.ForegroundProperty, u"#2997FF", True)
        g.HorizontalAlignment = HA.Center
        g.VerticalAlignment = VerticalAlignment.Center
        ic.Child = g
        sp.Children.Add(ic)
        t1 = TextBlock()
        t1.Text = u"No modules yet"
        t1.FontSize = 18.0
        t1.FontWeight = FontWeights.SemiBold
        self.mod_set(t1, TextBlock.ForegroundProperty, u"#F5F5F7")
        t1.HorizontalAlignment = HA.Center
        t1.Margin = Thickness(0, 18, 0, 4)
        sp.Children.Add(t1)
        t2 = TextBlock()
        t2.Text = u"Add your own .py script or create a new one from the template. It will appear here right away."
        self.mod_set(t2, TextBlock.ForegroundProperty, u"#8E8E93")
        t2.FontSize = 12.0
        t2.TextWrapping = TextWrapping.Wrap
        t2.TextAlignment = TextAlignment.Center
        t2.MaxWidth = 320.0
        t2.Margin = Thickness(0, 0, 0, 18)
        sp.Children.Add(t2)
        btn = self.mod_pill(u"Add module", u"\uE710", self.mod_add, None, u"pri")
        btn.HorizontalAlignment = HA.Center
        sp.Children.Add(btn)
        return sp

    def mod_card(self, path, fname):
        name = os.path.splitext(fname)[0]
        card = Border()
        card.CornerRadius = CornerRadius(22)
        self.mod_set(card, Border.BackgroundProperty, u"#111113")
        self.mod_set(card, Border.BorderBrushProperty, u"#1F1F22")
        card.BorderThickness = Thickness(1)
        card.Padding = Thickness(16, 14, 14, 14)
        card.Margin = Thickness(0, 0, 10, 10)
        card.MouseEnter += lambda s, e: self.mod_set(card, Border.BorderBrushProperty, u"#2C2C2E")
        card.MouseLeave += lambda s, e: self.mod_set(card, Border.BorderBrushProperty, u"#1F1F22")
        dp = DockPanel()

        ic = Border()
        ic.Width = 44.0
        ic.Height = 44.0
        ic.CornerRadius = CornerRadius(13)
        ic.Background = isl_brush(self.MOD_COLORS[sum(ord(c) for c in name) % len(self.MOD_COLORS)])
        ic.VerticalAlignment = VerticalAlignment.Center
        ic.Margin = Thickness(0, 0, 14, 0)
        g = TextBlock()
        g.Text = u"\uE943"
        g.FontFamily = ICON_FONT
        g.FontSize = 18.0
        g.Foreground = Brushes.White
        g.HorizontalAlignment = System.Windows.HorizontalAlignment.Center
        g.VerticalAlignment = VerticalAlignment.Center
        ic.Child = g
        DockPanel.SetDock(ic, Dock.Left)
        dp.Children.Add(ic)

        btns = StackPanel()
        btns.Orientation = Orientation.Horizontal
        btns.VerticalAlignment = VerticalAlignment.Center
        DockPanel.SetDock(btns, Dock.Right)
        run = self.mod_pill(u"Run", u"\uE768", lambda p=path: self.mod_run(p),
                            u"Run the module in the current document", u"pri")
        run.Margin = Thickness(12, 0, 8, 0)
        btns.Children.Add(run)
        ed = self.mod_pill(u"", u"\uE70F", lambda p=path: self.mod_edit(p), u"Open in editor")
        ed.Margin = Thickness(0, 0, 6, 0)
        btns.Children.Add(ed)
        btns.Children.Add(self.mod_pill(u"", u"\uE74D", lambda p=path: self.mod_delete(p), u"Delete module", u"danger"))
        dp.Children.Add(btns)

        txt = StackPanel()
        txt.VerticalAlignment = VerticalAlignment.Center
        t1 = TextBlock()
        t1.Text = name
        t1.FontSize = 15.0
        t1.FontWeight = FontWeights.SemiBold
        self.mod_set(t1, TextBlock.ForegroundProperty, u"#F5F5F7")
        t1.TextTrimming = TextTrimming.CharacterEllipsis
        txt.Children.Add(t1)
        desc = self.mod_desc(path)
        if desc:
            t2 = TextBlock()
            t2.Text = desc
            self.mod_set(t2, TextBlock.ForegroundProperty, u"#A1A1A6")
            t2.FontSize = 12.0
            t2.TextWrapping = TextWrapping.Wrap
            t2.Margin = Thickness(0, 2, 0, 0)
            txt.Children.Add(t2)
        try:
            meta = u"{:.1f} KB  \u00B7  modified {}".format(
                os.path.getsize(path) / 1024.0,
                datetime.datetime.fromtimestamp(os.path.getmtime(path)).strftime(u"%d.%m.%Y"))
        except Exception:
            meta = u""
        if meta:
            t3 = TextBlock()
            t3.Text = meta
            self.mod_set(t3, TextBlock.ForegroundProperty, u"#8E8E93")
            t3.FontSize = 10.5
            t3.Margin = Thickness(0, 4, 0, 0)
            txt.Children.Add(t3)
        dp.Children.Add(txt)
        card.Child = dp
        return card

    def mod_add(self):
        try:
            dlg = OpenFileDialog()
            dlg.Filter = u"Python (*.py)|*.py"
            dlg.Multiselect = True
            if dlg.ShowDialog(self.win):
                d = self.mod_dir()
                for src in dlg.FileNames:
                    shutil.copy2(src, os.path.join(d, os.path.basename(src)))
                self.mod_refresh()
                self.set_status(u"Modules added: {}".format(len(dlg.FileNames)))
        except Exception as ex:
            tk_log(u"mod_add: {}\n{}".format(ex, traceback.format_exc()))
            self.set_status(u"Could not add: {}".format(err_text(ex)))

    def mod_new(self):
        try:
            d = self.mod_dir()
            n, p = 1, os.path.join(d, u"new_module.py")
            while os.path.exists(p):
                n += 1
                p = os.path.join(d, u"new_module_{}.py".format(n))
            with codecs.open(p, 'w', 'utf-8') as f:
                f.write(self.MOD_TEMPLATE)
            self.mod_refresh()
            self.mod_edit(p)
        except Exception as ex:
            tk_log(u"mod_new: {}\n{}".format(ex, traceback.format_exc()))
            self.set_status(u"Could not create: {}".format(err_text(ex)))

    def mod_edit(self, path):
        try:
            os.startfile(path)
        except Exception as ex:
            self.set_status(u"Could not open: {}".format(err_text(ex)))

    def mod_open_dir(self):
        try:
            os.startfile(self.mod_dir())
        except Exception as ex:
            self.set_status(u"Could not open the folder: {}".format(err_text(ex)))

    def mod_delete(self, path):
        if MessageBox.Show(u"Delete module \"{}\"?".format(os.path.basename(path)), u"Modules",
                           MessageBoxButton.YesNo) != MessageBoxResult.Yes:
            return
        try:
            os.remove(path)
        except Exception as ex:
            self.set_status(u"Could not delete: {}".format(err_text(ex)))
        self.mod_refresh()

    def mod_run(self, path):
        self.set_status(u"Running: {}…".format(os.path.basename(path)))
        self.run(lambda ua, p=path: self.mod_exec(ua, p), u"mod:" + path)

    def mod_exec(self, ua, path):
        """Runs in the Handler -> a valid Revit API context. Fresh uiapp/uidoc/doc each time."""
        name = os.path.basename(path)
        tk_log(u"mod: run " + name)
        try:
            with codecs.open(path, 'r', 'utf-8-sig') as f:
                lines = f.read().split(u"\n")
            for i in range(min(2, len(lines))):      # IronPython does not accept a coding line in unicode code
                if re.match(u"^[ \\t\\f]*#.*?coding[:=]", lines[i]):
                    lines[i] = u"#"
            src = u"\n".join(lines)
            ud = ua.ActiveUIDocument
            ns = {"__name__": "__main__", "__file__": path, "__revit__": ua, "uiapp": ua,
                  "uidoc": ud, "doc": (ud.Document if ud else None), "TOOLKIT": self}
            exec(compile(src, path, "exec"), ns)
            if self.tab == 6 and self.tbModStatus.Text.startswith(u"Run"):
                self.set_status(u"Done: {}".format(name))
        except Exception as ex:
            tk_log(u"mod: FAIL {}: {}\n{}".format(name, ex, traceback.format_exc()))
            self.set_status(u"{}: {}".format(name, err_text(ex)))

    # ================= tabs =================
    def show_tab(self, idx, save=True):
        self.tab = idx
        try:    # the collapsed island shows which tab is open
            self.tbPillTab.Text = (u"Print Sets", u"Tools", u"Params", u"Views", u"Home", u"Annotations", u"Modules")[idx]
        except Exception:
            pass
        self.pageHome.Visibility = Visibility.Visible if idx == 4 else Visibility.Collapsed
        self.pagePrint.Visibility = Visibility.Visible if idx == 0 else Visibility.Collapsed
        self.sideSets.Visibility = Visibility.Visible if idx in (0, 3) else Visibility.Collapsed
        self.pageTools.Visibility = Visibility.Visible if idx == 1 else Visibility.Collapsed
        if self.pageTile is not None:
            self.pageTile.Visibility = Visibility.Visible if idx == 2 else Visibility.Collapsed
        if self.pageNm is not None:
            self.pageNm.Visibility = Visibility.Visible if idx == 3 else Visibility.Collapsed
        self.pageAnn.Visibility = Visibility.Visible if idx == 5 else Visibility.Collapsed
        self.pageMod.Visibility = Visibility.Visible if idx == 6 else Visibility.Collapsed
        self.compact_apply_side(reset=True)
        self.btnRefresh.ToolTip = (u"Re-index sets and sheets from Revit" if idx == 0
                                   else u"Refresh the table from the Revit selection" if idx == 2
                                   else u"Refresh project data" if idx == 4
                                   else u"Re-read the annotations of the current model" if idx == 5
                                   else u"Re-read the selected sheets")
        if save and idx < 2:
            self.settings["tab"] = idx
            save_settings(self.settings)
        tk_log(u'show_tab {}'.format(idx))
        if idx == 4:
            self.home_refresh()
        if idx == 6:
            self.mod_refresh()
        if idx == 2:
            if not self.tile["loaded"]:
                self.run(self.do_tile_first, "tilefirst")
        elif idx == 3:
            self.run(self.do_nm_first, "nmfirst")
        elif idx == 5:
            self.run(self.do_ann_first, "annfirst")
        elif idx == 0:
            if self.items_dirty:
                self.items_dirty = False
                self.render_items()
            self.run(self.do_sync, "sync")

    def on_loaded(self, s, e):
        tk_log(u'window loaded')
        self.request_reindex()
        self.home_refresh()

    def on_activated(self, s, e):
        if self.tools_busy:
            return
        if self.tab >= 1:
            return   # tables are not rebuilt on activation, so edits are not lost
        self.run(self.do_sync, "sync")

    def on_refresh(self, s, e):
        if self.tab == 6:
            self.mod_refresh()
            return
        if self.tab == 3:
            self.nm["force"] = True
            self.request_reindex()
        elif self.tab == 5:
            try:
                if self.ann.get("doc"):
                    ann_cache_clear(self.ann["doc"])      # "Refresh" = regenerate the previews
                self.ann["img"] = {}
            except Exception:
                pass
            self.ann_reload()
        elif self.tab == 2:
            self.tile_update()
        elif self.tab == 1:
            return
        else:
            self.request_reindex()
            self.home_refresh()

    # ================= Tools: Elevation markers and view from selection =================
    def tools_go(self, action):
        if self.tools_busy or self.closed:
            return
        self.tools_busy = True
        self.tools_job = action
        self.tools_status(u"")
        if action != "viewmaker":
            self.win.Hide()   # the selection in Revit must not hide behind our Topmost window (does not apply to the strips)
        self.handler.queue.append(("toolsact", self.do_tools_action))
        req = self.ev.Raise()
        if req != ExternalEventRequest.Accepted and req != ExternalEventRequest.Pending:
            self.handler.queue = [q for q in self.handler.queue if q[0] != "toolsact"]
            self.tools_busy = False
            self.tools_status(u"Revit did not accept the action. Try again after the active command finishes.")
            if not getattr(self, "_mini", False):
                self.win.Show()

    def hdr_view_toggle(self):
        """View -> Sheet icon: open the view creation strip or hide it if it is already visible."""
        if _VM[0] is not None and not getattr(_VM[0], "hidden", False) and bar_state() == u"vm":
            return        # the only visible strip is not turned off; it can be closed with the cross on the strip
        if _VM[0] is not None:
            bar_toggle(u"vm")
        else:
            self.tools_go("viewmaker")

    def hdr_paint(self, state=None):
        """Lime highlight of the icons when the corresponding strip is open."""
        try:
            if state is None:
                state = bar_state()
            on = ann_brush(TK_LIGHT_FG[u"#2997FF"] if TK_ISL[u"light"] else u"#2997FF")
            off = isl_brush(u"#C7C7CC")
            self.icHdrAnnBar.Foreground = on if state in (u"ann", u"both") else off
            self.icHdrView.Foreground = on if state in (u"vm", u"both") else off
        except Exception as ex:
            tk_log(u"hdr_paint: {}".format(ex))

    def hdr_toast(self, text):
        """The status of an action from a header icon is shown in the document chip (on tabs without their own status)."""
        try:
            self.tbDocChip.Text = text
            t = getattr(self, "_toast_timer", None)
            if t is None:
                t = DispatcherTimer()
                t.Interval = TimeSpan.FromMilliseconds(5000)

                def done(s, e):
                    t.Stop()
                    self.home_refresh()
                t.Tick += done
                self._toast_timer = t
            t.Stop()
            t.Start()
        except Exception:
            pass

    def tools_status(self, text):
        if text and self.tab != 4:
            self.hdr_toast(text)
        self.tbToolsStatus.Text = text or u""
        try:
            self.tbHomeStatus.Text = text or u""
        except Exception:
            pass

    def tools_browser_changed(self, s, e):
        raw = self.tbBrowserParams.Text or u""
        names = [x.strip() for x in re.split(u'[,;\\n]', raw) if x.strip()]
        BROWSER_PARAMS[:] = names
        self.settings["browser_params"] = names
        save_settings(self.settings)

    def do_tools_action(self, uiapp):
        global uidoc, doc
        action = self.tools_job
        self.tools_job = None
        status = u""
        try:
            uidoc = uiapp.ActiveUIDocument
            doc = uidoc.Document if uidoc else None
            if doc is None or doc.IsFamilyDocument:
                fail(u"Open an RVT project.")
            if action == "snapmarkers":
                status = snap_elevation_markers()
            elif action == "movemarker":
                status = open_marker_nudge(uiapp)
            elif action == "viewmaker":
                status = open_view_maker(uiapp)
        except (Cancelled, OperationCanceledException):
            status = u"Cancelled."
        except Exception as exc:
            print(traceback.format_exc())
            status = u"The operation was not completed: " + err_text(exc)
            TaskDialog.Show(u"Universal Toolkit", status)
        self.tools_busy = False
        self.tools_status(status)
        try:
            if not getattr(self, "_mini", False):
                if not self.win.IsVisible:
                    self.win.Show()
                if action != "viewmaker":
                    self.win.Activate()
        except Exception:
            pass


    # ---------- UI events ----------
    def on_swallow(self, s, e):
        e.Handled = True

    def on_close(self, s, e):
        """Closing takes two clicks: the first "arms" the button (red, 2.5 s), the second closes.
        This way an accidental click near the collapse button closes nothing."""
        e.Handled = True
        if getattr(self, "_close_armed", False):
            self._close_disarm()
            self.win.Close()
            return
        self._close_armed = True
        try:
            self.btnClose.Background = ann_brush(u"#FF3B30")
            self.btnClose.Child.Foreground = ann_brush(u"#FFFFFF")
            self.btnClose.ToolTip = u"Click again to close Toolkit"
            t = DispatcherTimer()
            t.Interval = TimeSpan.FromMilliseconds(2500)
            t.Tick += lambda s2, e2: self._close_disarm()
            self._close_timer = t
            t.Start()
        except Exception as ex:
            tk_log(u"close arm: {}".format(ex))
            self._close_armed = False
            self.win.Close()

    def _close_disarm(self):
        self._close_armed = False
        try:
            self._close_timer.Stop()
        except Exception:
            pass
        try:
            self.btnClose.ClearValue(Border.BackgroundProperty)
            self.btnClose.Child.Foreground = isl_brush(u"#C7C7CC")
            self.btnClose.ToolTip = u"Close (two clicks: the first one only \"arms\" the button)"
        except Exception:
            pass

    def on_closed(self, s, e):
        self.closed = True
        for _tn in (u"_ann_stimer", u"_ann_ptimer", u"_home_timer"):
            try:
                getattr(self, _tn).Stop()
            except Exception:
                pass
        try:
            self.mini_hide()
            if self._mini_win is not None:
                self._mini_win.Close()
        except Exception:
            pass
        try:
            self._isl_timer.Stop()
        except Exception:
            pass
        self.island_save_pos()
        try:
            self.ann_bar_close(False)
        except Exception:
            pass
        try:
            if _VM[0] is not None:
                _VM[0].bar_show()
        except Exception:
            pass
        try:
            self.ev.Dispose()
        except Exception:
            pass

    # ---------- Island theme: light / dark following the Windows theme (like the bottom strips) ----------
    def isl_theme_start(self):
        self._isl_timer = DispatcherTimer()
        self._isl_timer.Interval = TimeSpan.FromMilliseconds(1500)
        self._isl_timer.Tick += lambda s, e: self.isl_theme_tick()
        self._isl_timer.Start()
        self.isl_theme_named()      # only named elements (notch): the rest were already colored on load

    def isl_theme_tick(self):
        if getattr(self, "closed", False):
            return
        try:
            light = not ann_sys_dark()
            if light != TK_ISL[u"light"]:
                self.isl_apply_theme(light)
        except Exception as ex:
            tk_log(u"isl theme tick: {}\n{}".format(ex, traceback.format_exc()))

    def isl_theme_named(self):
        """Notch / island body / hover film - separate elements with their own colors."""
        light = TK_ISL[u"light"]
        body = ann_brush(TK_NOTCH_LIGHT if light else TK_NOTCH_DARK)
        try:
            self.island.Background = body
            self.win.FindName("islandFilletL").Fill = body
            self.win.FindName("islandFilletR").Fill = body
            self.pillHover.Background = ann_brush(u"#000000" if light else u"#FFFFFF")
        except Exception as ex:
            tk_log(u"isl notch: {}".format(ex))

    def isl_apply_theme(self, light):
        """Live switching: 1) styles/templates (Window.Resources), 2) local element colors, 3) notch."""
        TK_ISL[u"light"] = light
        tk_log(u"island theme -> {}".format(u"light" if light else u"dark"))
        w = self.win
        try:
            isl_set_brushes(w.Resources)
        except Exception as ex:
            tk_log(u"isl theme brushes: {}\n{}".format(ex, traceback.format_exc()))
        n = isl_recolor_tree(w, light)
        self.isl_theme_named()
        try:
            self.hdr_paint()
        except Exception:
            pass
        try:
            w.InvalidateVisual()
        except Exception:
            pass
        tk_log(u"island theme: recolored {} elements".format(n))

    def on_drag(self, s, e):
        try:
            self.win.DragMove()
        except Exception:
            pass
        self.win.Top = self.island_top()
        self.island_save_pos()

    def on_pin(self, s, e):
        e.Handled = True
        self.win.Topmost = not self.win.Topmost
        self.btnPin.Opacity = 1.0 if self.win.Topmost else 0.35

    def on_set_picked(self, s, e):
        # selecting a set - entirely from the cache, without calling the Revit API
        if self._filling or e.AddedItems.Count == 0:
            return
        name = unicode(e.AddedItems[0].Tag)
        if self.tab == 3:
            if name != self.cur_name:
                self.cur_name = name
                self.items_dirty = True          # Print Sets will rebuild the sheet list when it is returned to
                self.nm_set_changed()
            return
        self.cur_name = name
        self.recent_add("sets", name)
        if self.tbItemSearch.Text:
            self.tbItemSearch.Text = u""      # TextChanged will call render_items by itself
        else:
            self.render_items()

    def on_set_search_tick(self):
        self._set_timer.Stop()
        self.render_sets()

    def on_sort(self, s, e):
        self.sort_mode = (self.sort_mode + 1) % len(SORT_MODES)
        self.btnSort.Content = u"Sorting: " + SORT_MODES[self.sort_mode][1]
        self.render_items()

    def make_groups(self, items):
        """Groups for printing: as in Project Browser (the last folder level = group)."""
        if SORT_MODES[self.sort_mode][0] != "browser":
            return [(None, [i["id"] for i in items])]
        groups, last = [], None
        for i in items:
            k = (i["kind"], tuple(i["folders"]))
            if k != last:
                groups.append((u" \u203A ".join(i["folders"][-1:]) or u"(no group)", []))
                last = k
            groups[-1][1].append(i["id"])
        return groups

    def on_print_ord(self, s, e):
        groups = self.make_groups(self.sorted_items(self.current_items()))
        total = sum(len(g[1]) for g in groups)
        if not total:
            return
        if self.exp_fmt() != u"pdf":
            if confirm(self.win, self.exp_confirm_text(len(groups), total)):
                self.start_print(groups)
            return
        if len(groups) > 1 or groups[0][0] is not None:
            txt = u"Send {} groups ({} sheets) to print, group by group, in Project Browser order?\n\nPrinter and format - from the current Print settings.".format(
                len(groups), total)
        else:
            txt = u"Send {} sheets to print one by one, in this order:\n{}\n\nPrinter and format - from the current Print settings.".format(
                total, SORT_MODES[self.sort_mode][1])
        if confirm(self.win, txt):
            self.start_print(groups)

    def on_revs(self, s, e):
        sel = [i for i in self.selected_ids() if self.meta_cache.get(i, {}).get("kind") == 0]
        if sel:
            targets, scope = sel, u"selected sheets ({})".format(len(sel))
        else:
            exists = self.cur_name in self.sets
            items = self.current_items() if exists else self.build_items(self.sel_ids)
            targets = [i["id"] for i in items if i["kind"] == 0]
            scope = u"ALL sheets of the set ({})".format(len(targets)) if exists else u"sheets selected in Revit ({})".format(len(targets))
        if not targets:
            return self.set_status(u"No sheets: select them in the list or choose a set.")
        if not self.revs:
            return self.set_status(u"The project has no revisions (try 'Refresh sheets').")
        states = {}
        for rid in self.revs:
            n = sum(1 for t in targets if rid in self.meta_cache[t].get("revs", []))
            states[rid] = True if n == len(targets) else (False if n == 0 else None)
        revs = sorted(self.revs.values(), key=lambda x: -x["seq"])
        changes = ask_revisions(self.win, u"Revisions: " + scope, revs, states)
        if not changes:
            return
        self.run(lambda ua: self.do_apply_revisions(ua, targets, changes), label=u"Sheet revisions", wrap=True)

    def reselect(self, ids):
        ids = set(ids)
        self._sel_busy = True
        try:
            for it in self.lstItems.Items:
                if not isinstance(it.Tag, basestring) and int(it.Tag) in ids:
                    it.IsSelected = True
        finally:
            self._sel_busy = False

    def on_make_sets(self, s, e):
        groups = [g for g in self.make_groups(self.sorted_items(self.current_items())) if g[0]]
        if not groups:
            return self.set_status(u"Grouping is available only in the 'As in Project Browser' mode.")
        txt = u"Create {} separate Print Sets (one per group) named '{} | <group>'?\n\nExisting sets with such names will be updated.".format(
            len(groups), self.cur_name)
        if confirm(self.win, txt):
            base = self.cur_name
            self.run(lambda ua: self.do_make_sets(ua, base, groups), label=u"Create sets", wrap=True)

    def do_apply_revisions(self, uiapp, sheet_ids, changes):
        doc = uiapp.ActiveUIDocument.Document
        changed, fail = 0, []
        t = Transaction(doc, "Sheet revisions")
        t.Start()
        try:
            for sid in sheet_ids:
                sh = doc.GetElement(ElementId(int(sid)))
                if not isinstance(sh, ViewSheet):
                    continue
                cur = set(r.IntegerValue for r in sh.GetAdditionalRevisionIds())
                new = set(cur)
                for rid, on in changes.items():
                    if on:
                        new.add(rid)
                    else:
                        new.discard(rid)
                if new == cur:
                    continue
                ids = List[ElementId]()
                for r in sorted(new):
                    ids.Add(ElementId(int(r)))
                try:
                    sh.SetAdditionalRevisionIds(ids)
                    changed += 1
                    if sid in self.meta_cache:
                        self.meta_cache[sid]["revs"] = sorted(new)
                except Exception as ex:
                    fail.append(u"{}: {}".format(sh.SheetNumber, ex))
            t.Commit()
        except:
            t.RollBack()
            raise
        self.render_items()
        self.reselect(sheet_ids)
        add = len([1 for v in changes.values() if v])
        rem = len(changes) - add
        msg = u"Revisions updated on {} sheets (added: {}, removed: {}).".format(changed, add, rem)
        if fail:
            msg += u" Failed for {}: {}".format(len(fail), fail[0])
        self.set_status(msg)

    def do_make_sets(self, uiapp, base, groups):
        doc = uiapp.ActiveUIDocument.Document
        names, made = [], 0
        seen = {}
        for title, ids in groups:
            seen[title] = seen.get(title, 0) + 1
            nm = u"{} | {}".format(base, title)
            if seen[title] > 1:
                nm = u"{} ({})".format(nm, seen[title])
            views = [doc.GetElement(ElementId(int(i))) for i in ids]
            views = sorted([v for v in views if v is not None], key=sort_key)
            if not views:
                continue
            existing = self.get_sets(doc).get(nm)
            if existing is not None:
                self._overwrite(doc, existing, views)
            else:
                self._save_new(doc, views, nm)
            names.append(nm)
            made += 1
        self.update_sets(uiapp, names)
        self.set_status(u"Created/updated {} sets. In the Print dialog (Revit) pick the needed set and turn on 'Combine multiple selected views/sheets'.".format(made))

    def pick_folder(self):
        dlg = FolderBrowserDialog()
        dlg.Description = u"Folder for the files (each file name = group name)"
        last = self.settings.get("out_dir")
        if last and os.path.isdir(last):
            dlg.SelectedPath = last
        top = self.win.Topmost
        self.win.Topmost = False
        try:
            res = dlg.ShowDialog()
        finally:
            self.win.Topmost = top
        if res != DialogResult.OK:
            return None
        self.settings["out_dir"] = dlg.SelectedPath
        save_settings(self.settings)
        return dlg.SelectedPath

    # ---------- DXF / DWG / DWF / DGN export ----------
    def exp_fmt(self):
        i = self.cmbFmt.SelectedIndex
        return EXP_FORMATS[i] if 0 <= i < len(EXP_FORMATS) else u"pdf"

    def init_export_ui(self):
        self._exp_init = True
        self._setups_doc = None
        try:
            st = self.settings
            idx = int(st.get("exp_fmt", 0) or 0)
            self.cmbFmt.SelectedIndex = idx if 0 <= idx < len(EXP_FORMATS) else 0
            self.tbPrefix.Text = st.get("exp_prefix", u"") or u""
            self.tbTemplate.Text = st.get("exp_tpl", EXP_TPL) or EXP_TPL
            self.chkDots.IsChecked = bool(st.get("exp_dots", True))
            self.chkSub.IsChecked = bool(st.get("exp_sub", False))
            self.chkXref.IsChecked = bool(st.get("exp_xref", False))
        finally:
            self._exp_init = False
        self.cmbFmt.SelectionChanged += lambda s, e: self.exp_changed(True)
        self.cmbSetup.SelectionChanged += lambda s, e: self.exp_changed(False)
        self.tbPrefix.TextChanged += lambda s, e: self.exp_changed(False)
        self.tbTemplate.TextChanged += lambda s, e: self.exp_changed(False)
        for c in (self.chkDots, self.chkSub, self.chkXref):
            c.Checked += lambda s, e: self.exp_changed(False)
            c.Unchecked += lambda s, e: self.exp_changed(False)
        self.exp_sync_ui()

    def exp_changed(self, fmt_changed):
        if getattr(self, "_exp_init", True):
            return
        st = self.settings
        st["exp_fmt"] = self.cmbFmt.SelectedIndex
        st["exp_prefix"] = self.tbPrefix.Text or u""
        st["exp_tpl"] = self.tbTemplate.Text or EXP_TPL
        st["exp_dots"] = bool(self.chkDots.IsChecked)
        st["exp_sub"] = bool(self.chkSub.IsChecked)
        st["exp_xref"] = bool(self.chkXref.IsChecked)
        sel = self.cmbSetup.SelectedItem
        if sel is not None and self.cmbSetup.SelectedIndex >= 0:
            st["exp_setup"] = u"" if self.cmbSetup.SelectedIndex == 0 else unicode(sel.Content)
        save_settings(st)
        self.exp_sync_ui()
        if fmt_changed:
            self.render_items()      # label of the "Print" / "Export" buttons in the group headers

    def exp_sync_ui(self):
        fmt = self.exp_fmt()
        cad = fmt != u"pdf"
        self.pnlCad.Visibility = Visibility.Visible if cad else Visibility.Collapsed
        self.gridNative.Visibility = Visibility.Collapsed if cad else Visibility.Visible
        self.gridCombined.Visibility = Visibility.Visible if (not cad or fmt in (u"dwf", u"dwfx")) else Visibility.Collapsed
        self.pnlSetup.Visibility = Visibility.Visible if fmt in (u"dxf", u"dwg") else Visibility.Collapsed
        self.gridXref.Visibility = Visibility.Visible if fmt in (u"dxf", u"dwg") else Visibility.Collapsed
        self.txtPrintOrd.Text = u"Print by groups" if not cad else u"Export {} by groups".format(fmt.upper())
        if cad:
            self.txtNamePreview.Text = u"Example: " + self.exp_example() + u"." + fmt
            if fmt in (u"dxf", u"dwg") and self._setups_doc != self.doc_title:
                self.run(self.load_setups, "exp_setups")

    def exp_example(self):
        num, name, kind = u"03.0", u"B9 - GUEST BATHROOM VANITY - TITLE", u"Sheet"
        try:
            for i in self.current_items():
                if i.get("kind") == 0:
                    num, name = i.get("num") or num, i.get("name") or name
                    break
        except Exception:
            pass
        return build_export_name(self.tbTemplate.Text or EXP_TPL, self.tbPrefix.Text, kind, num, name,
                                 u"", self.cur_name or u"", 1, bool(self.chkDots.IsChecked))

    def load_setups(self, uiapp):
        """List of saved DWG/DXF settings from the project (Export Setups)."""
        try:
            doc = uiapp.ActiveUIDocument.Document
        except Exception:
            return
        names = []
        try:
            if BaseExportOptions is not None:
                names = sorted([unicode(n) for n in BaseExportOptions.GetPredefinedSetupNames(doc)], key=lambda x: x.lower())
        except Exception as ex:
            tk_log(u"export setups: {}".format(ex))
        want = self.settings.get("exp_setup", u"")
        self._exp_init = True
        try:
            self.cmbSetup.Items.Clear()
            first = ComboBoxItem()
            first.Content = u"Standard (Revit defaults)"
            self.cmbSetup.Items.Add(first)
            pick = 0
            for n in names:
                it = ComboBoxItem()
                it.Content = n
                self.cmbSetup.Items.Add(it)
                if n == want:
                    pick = self.cmbSetup.Items.Count - 1
            self.cmbSetup.SelectedIndex = pick
        finally:
            self._exp_init = False
        self._setups_doc = self.doc_title

    def exp_cfg(self):
        fmt = self.exp_fmt()
        setup = u""
        if fmt in (u"dxf", u"dwg") and self.cmbSetup.SelectedIndex > 0:
            setup = unicode(self.cmbSetup.SelectedItem.Content)
        return {"fmt": fmt, "prefix": self.tbPrefix.Text or u"", "tpl": self.tbTemplate.Text or EXP_TPL,
                "dots": bool(self.chkDots.IsChecked), "sub": bool(self.chkSub.IsChecked),
                "xref": bool(self.chkXref.IsChecked), "setup": setup,
                "combined": bool(self.chkCombined.IsChecked) and fmt in (u"dwf", u"dwfx")}

    def exp_confirm_text(self, ngroups, total):
        cfg = self.exp_cfg()
        txt = u"Export {} sheets ({} groups) to {}?\n\n".format(total, ngroups, cfg["fmt"].upper())
        if cfg["combined"]:
            txt += u"One file per group, name = group name.\n"
        else:
            txt += u"A separate file for each sheet.\nName example: {}.{}\n".format(self.exp_example(), cfg["fmt"])
        if cfg["sub"]:
            txt += u"Each group - in its own subfolder.\n"
        return txt

    def make_cad_options(self, doc, cfg):
        fmt = cfg["fmt"]
        if fmt in (u"dxf", u"dwg"):
            cls = DXFExportOptions if fmt == u"dxf" else DWGExportOptions
            if cls is None:
                raise ValueError(u"This Revit version does not support {} export.".format(fmt.upper()))
            opts = None
            if cfg["setup"] and DWGExportOptions is not None:
                src_opts = None
                for owner in (cls, DWGExportOptions):
                    try:
                        src_opts = owner.GetPredefinedOptions(doc, cfg["setup"])
                    except Exception:
                        src_opts = None
                    if src_opts is not None:
                        break
                if src_opts is None:
                    raise ValueError(u"Could not read the export setup '{}'.".format(cfg["setup"]))
                if isinstance(src_opts, cls) and src_opts.GetType() == cls().GetType():
                    opts = src_opts
                else:
                    opts = cls()                 # DWG setup -> DXF: we carry over all properties with the same name
                    for p in src_opts.GetType().GetProperties():
                        try:
                            q = opts.GetType().GetProperty(p.Name)
                            if p.CanRead and q is not None and q.CanWrite and p.GetIndexParameters().Length == 0:
                                q.SetValue(opts, p.GetValue(src_opts, None), None)
                        except Exception:
                            pass
            if opts is None:
                opts = cls()
            try:
                opts.MergedViews = not cfg["xref"]    # checkbox 'Export views on sheets and links as external references'
            except Exception:
                pass
            return opts
        cls = {u"dgn": DGNExportOptions, u"dwf": DWFExportOptions, u"dwfx": DWFXExportOptions}[fmt]
        if cls is None:
            raise ValueError(u"This Revit version does not support {} export.".format(fmt.upper()))
        opts = cls()
        if fmt in (u"dwf", u"dwfx"):
            try:
                opts.MergedViews = bool(cfg["combined"])
            except Exception:
                pass
        return opts

    def export_cad(self, doc, cfg, opts, folder, name, views):
        if cfg["fmt"] in (u"dwf", u"dwfx"):
            return doc.Export(folder, name, self.to_viewset(views), opts)
        ids = List[ElementId]()
        for v in views:
            ids.Add(v.Id)
        return doc.Export(folder, name, ids, opts)

    def export_one(self, doc, st, nm, views):
        """One group -> files in the folder (or the group's subfolder). Returns the number of exported sheets."""
        cfg, fmt = st["cfg"], st["cfg"]["fmt"]
        folder = st["folder"]
        if cfg["sub"]:
            folder = os.path.join(folder, nm)
            if not os.path.isdir(folder):
                os.makedirs(folder)
        if cfg["combined"]:
            self.print_check_target(os.path.join(folder, nm + u"." + fmt))
            if not self.export_cad(doc, cfg, st["opts"], folder, nm, views):
                raise ValueError(u"Revit returned an export error for group '{}'".format(nm))
            return len(views)
        done = 0
        for idx, v in enumerate(views, 1):
            number = v.SheetNumber if isinstance(v, ViewSheet) else u""
            base = build_export_name(cfg["tpl"], cfg["prefix"], view_kind_word(v), number, v.Name,
                                     nm, self.cur_name or u"", idx, cfg["dots"])
            fname, n = base, 1
            while (folder + u"|" + fname).lower() in st["used"]:
                n += 1
                fname = u"{} ({})".format(base, n)
            st["used"].add((folder + u"|" + fname).lower())
            tk_log(u"  export {} -> {}.{}".format(self.label(v), fname, fmt))
            try:
                self.print_check_target(os.path.join(folder, fname + u"." + fmt))
                if self.export_cad(doc, cfg, st["opts"], folder, fname, [v]):
                    done += 1
                    self.prog_update(st["sheets"] + done)
                else:
                    st["failed"].append(u"{}: Revit returned an error".format(self.label(v)))
            except Exception as ex:
                tk_log(u"  export FAIL {}: {}".format(self.label(v), ex))
                st["failed"].append(u"{}: {}".format(self.label(v), err_text(ex)))
        return done

    def start_print(self, groups):
        if self._print_busy and time.time() - self._print_busy_at < 900:
            return self.set_status(u"Printing is still in progress. Wait for it to finish.")
        folder = None
        if self.chkCombined.IsChecked or self.exp_fmt() != u"pdf":
            folder = self.pick_folder()
            if not folder:
                return
        self._print_busy = True
        self._print_busy_at = time.time()
        self.prog_begin(sum(len(ids) for _t, ids in groups))
        self.run(lambda ua: self.print_job(ua, groups, folder), label=u"Print / export (sets)")

    def on_print_group(self, tag):
        data = self.grp_ids.get(tag)
        if not data:
            return
        title, ids = data
        if self.exp_fmt() != u"pdf":
            if confirm(self.win, self.exp_confirm_text(1, len(ids))):
                self.start_print([(title, ids)])
            return
        if confirm(self.win, u"Send group '{}' ({} sheets) to print?\n\nPrinter and format - from the current Print settings.".format(title, len(ids))):
            self.start_print([(title, ids)])

    def on_items_sel(self, s, e):
        """A click on a group header selects all its sheets."""
        if self._sel_busy or e.AddedItems.Count == 0:
            return
        heads = [i for i in e.AddedItems if isinstance(i.Tag, basestring)]
        if not heads:
            return
        self._sel_busy = True
        try:
            for h in heads:
                h.IsSelected = False
                for it in self.grp_items.get(h.Tag, []):
                    it.IsSelected = True
        finally:
            self._sel_busy = False

    def selected_ids(self):
        out = []
        for i in self.lstItems.SelectedItems:
            if not isinstance(i.Tag, basestring):
                out.append(int(i.Tag))
        return out

    def on_remove(self, s, e):
        ids = self.selected_ids()
        if not ids:
            return self.set_status(u"Select the sheets to remove in the list.")
        self.run(lambda ua: self.do_remove(ua, ids), label=u"Remove from set", wrap=True)

    def on_rename(self, s, e):
        if not self.cur_name:
            return
        new = ask_string(self.win, u"Rename set", u"New name:", self.cur_name)
        if new and new.strip() and new.strip() != self.cur_name:
            self.run(lambda ua: self.do_rename(ua, new.strip()), label=u"Rename set", wrap=True)

    def on_dup(self, s, e):
        if not self.cur_name:
            return
        new = ask_string(self.win, u"Duplicate set", u"Copy name:", self.cur_name + u" copy")
        if new and new.strip():
            self.run(lambda ua: self.do_duplicate(ua, new.strip()), label=u"Duplicate set", wrap=True)

    def on_delete(self, s, e):
        if not self.cur_name:
            return
        if confirm(self.win, u"Delete set '{}'?".format(self.cur_name)):
            self.run(self.do_delete)

    # ================= Compact mode =================
    def compact_setup(self):
        # The old "compact mode" was replaced by collapsing into the island (island_*).
        self.cp = {"on": False, "undo": [], "drawer": False, "normal": None}
        self.btnCompact.MouseLeftButtonDown += self.on_swallow
        self.island_setup()

    def cp_set(self, obj, prop, value):
        old = getattr(obj, prop)
        self.cp["undo"].append(lambda o=obj, p=prop, v=old: setattr(o, p, v))
        setattr(obj, prop, value)

    def cp_attached(self, setter, obj, value, old):
        self.cp["undo"].append(lambda: setter(obj, old))
        setter(obj, value)

    def cp_current_side(self):
        return {0: self.sideSets, 3: self.sideSets, 1: self.sideTools, 5: self.sideAnn}.get(self.tab)

    def set_compact(self, on, save=True):
        cp = self.cp
        if bool(on) == cp["on"]:
            return
        win = self.win
        if on:
            cur_w = win.ActualWidth
            cp["normal"] = (win.ActualWidth, win.MinWidth)
            cp["on"] = True
            cw = float(self.settings.get("compact_w", 382))
            self.compact_apply(True)
            win.MinWidth = 340
            win.Width = cw
            win.Left = win.Left + cur_w - cw
        else:
            cur_w = win.ActualWidth
            self.settings["compact_w"] = cur_w
            cp["on"] = False
            cp["drawer"] = False
            self.compact_apply(False)
            nw, nmin = cp["normal"] if cp["normal"] else (1080.0, 960.0)
            win.MinWidth = nmin
            win.Width = nw
            try:
                left = win.Left + cur_w - nw
                area = System.Windows.SystemParameters.WorkArea
                win.Left = max(area.Left, min(left, area.Right - nw))
            except Exception:
                pass
            self.sideSets.Visibility = Visibility.Visible if self.tab in (0, 3) else Visibility.Collapsed
            self.sideTools.Visibility = Visibility.Visible
            self.sideAnn.Visibility = Visibility.Visible
            self.btnSide.Visibility = Visibility.Collapsed
        if save:
            self.settings["compact"] = bool(on)
            save_settings(self.settings)
        self.compact_apply_side()
        if self.ann["items"]:
            self.ann_render()

    def compact_apply(self, on):
        cp = self.cp
        if not on:
            for fn in reversed(cp["undo"]):
                try:
                    fn()
                except Exception as ex:
                    tk_log(u"compact undo: {}".format(ex))
            cp["undo"] = []
            return
        zero = System.Windows.GridLength(0.0)
        main = self.sideSets.Parent
        self.cp_set(main.ColumnDefinitions[0], "Width", zero)
        self.cp_set(self.pageTools.ColumnDefinitions[0], "Width", zero)
        self.cp_set(self.pageAnn.ColumnDefinitions[0], "Width", zero)
        # header: traffic light + ☰ + icon tabs + ⟳ in one row
        self.cp_attached(WpfGrid.SetColumn, self.dragA, 1, WpfGrid.GetColumn(self.dragA))
        self.cp_set(self.dragA, "HorizontalAlignment", AnnHAlign.Left)
        self.cp_set(self.dragA, "Width", 78.0)
        self.cp_set(self.sideSets.Parent.RowDefinitions[0], "Height", System.Windows.GridLength(80.0))
        self.cp_set(self.dragA, "VerticalAlignment", VerticalAlignment.Top)
        self.cp_set(self.dragA, "Height", 44.0)
        # dragB (the drag zone) lies in the same column and would have covered the dots
        self.cp_attached(System.Windows.Controls.Panel.SetZIndex, self.dragA, 70,
                         System.Windows.Controls.Panel.GetZIndex(self.dragA))
        self.cp_attached(System.Windows.Controls.Panel.SetZIndex, self.btnSide, 71,
                         System.Windows.Controls.Panel.GetZIndex(self.btnSide))
        self.cp_attached(System.Windows.Controls.Panel.SetZIndex, self.btnRefresh, 71,
                         System.Windows.Controls.Panel.GetZIndex(self.btnRefresh))
        self.cp_set(self.tabStrip, "VerticalAlignment", VerticalAlignment.Bottom)
        self.cp_set(self.tabStrip, "Margin", Thickness(0, 0, 0, 8))
        self.cp_set(self.btnSide, "VerticalAlignment", VerticalAlignment.Top)
        self.cp_set(self.btnSide, "Margin", Thickness(76, 7, 0, 0))
        self.cp_set(self.btnRefresh, "VerticalAlignment", VerticalAlignment.Top)
        self.cp_set(self.cbAnnSrc, "MinWidth", 150.0)
        self.cp_set(self.btnRefresh, "Content", u"\u27F3")
        self.cp_set(self.btnRefresh, "Margin", Thickness(0, 11, 8, 0))
        self.cp_set(self.btnRefresh, "ToolTip", self.btnRefresh.ToolTip)
        # sidebars -> a drawer over the content
        for side in (self.sideSets, self.sideTools, self.sideAnn):
            self.cp_attached(WpfGrid.SetColumn, side, 1, WpfGrid.GetColumn(side))
            self.cp_set(side, "HorizontalAlignment", AnnHAlign.Left)
            self.cp_set(side, "Width", 262.0)
            self.cp_set(side, "Background", isl_brush("#0F0F11"))
            self.cp_set(side, "Effect", CpShadow(BlurRadius=18, ShadowDepth=2, Opacity=0.28))
            self.cp_attached(System.Windows.Controls.Panel.SetZIndex, side, 50, System.Windows.Controls.Panel.GetZIndex(side))
            self.cp_set(side, "Visibility", Visibility.Collapsed)
        sides = [self.sideSets, self.sideTools, self.sideAnn]
        roots = [self.tabStrip] + [p for p in (self.pagePrint, self.pageTools, self.pageTile, self.pageNm,
                                                self.pageAnn) if p is not None]
        for root in roots:
            self.compact_walk(root, sides)
        try:
            self.compact_stack_header(self.btnSort.Parent, force=True)
            self.cp_set(self.btnSort, "HorizontalAlignment", AnnHAlign.Stretch)
        except Exception as ex:
            tk_log(u"compact sort: {}".format(ex))

    def compact_walk(self, root, sides):
        seg = None
        try:
            seg = self.win.FindResource("SegIcon")
        except Exception:
            pass
        stack = [root]
        while stack:
            el = stack.pop()
            if isinstance(el, WpfGrid) and el.ColumnDefinitions.Count == 2 and el.RowDefinitions.Count == 0:
                self.compact_stack_header(el)
            if isinstance(el, TextBlock):
                if el.FontSize >= 22:
                    self.cp_set(el, "FontSize", 17.0)
                if seg is not None and el.Style is not None and el.Style == seg and not cp_inside(el, sides):
                    self.compact_icon_only(el)
            if isinstance(el, StackPanel) and el.Orientation == Orientation.Horizontal:
                self.compact_form_row(el)
            if isinstance(el, Border):
                p = el.Padding
                if 16 <= p.Left <= 18:
                    self.cp_set(el, "Padding", Thickness(11, p.Top, 11, p.Bottom))
            if isinstance(el, CpRadio):
                self.cp_set(el, "MinWidth", 0.0)
                self.cp_set(el, "Padding", Thickness(7, 4, 7, 4))
            if isinstance(el, FrameworkElement):
                m = el.Margin
                if m.Left == 22 and m.Right == 22:
                    self.cp_set(el, "Margin", Thickness(10, m.Top, 10, m.Bottom))
                elif 100 <= m.Left <= 200:
                    self.cp_set(el, "Margin", Thickness(0, m.Top, m.Right, m.Bottom))
            if isinstance(el, CpItems):
                continue
            try:
                for ch in LogicalTreeHelper.GetChildren(el):
                    if isinstance(ch, FrameworkElement):
                        stack.append(ch)
            except Exception:
                pass

    def compact_form_row(self, sp):
        """A "label + field" row with a fixed width -> label above the field."""
        kids = list(sp.Children)
        if len(kids) < 2 or any(c is self.cbAnnSrc for c in kids):
            return
        wide = False
        for c in kids:
            if isinstance(c, ComboBox) or (isinstance(c, (WpfGrid, TextBlock)) and c.Width >= 100):
                wide = True
        if not wide:
            return
        nan = float("nan")
        self.cp_set(sp, "Orientation", Orientation.Vertical)
        for i, c in enumerate(kids):
            if isinstance(c, (WpfGrid, TextBlock)) and c.Width >= 100:
                self.cp_set(c, "Width", nan)
            if isinstance(c, ComboBox):
                self.cp_set(c, "MinWidth", 0.0)
            if isinstance(c, Button) and isinstance(c.Content, basestring):
                self.cp_set(c, "HorizontalAlignment", AnnHAlign.Left)
            if i > 0:
                m = c.Margin
                self.cp_set(c, "Margin", Thickness(0, 4, 0, m.Bottom))

    def compact_icon_only(self, icon):
        p = icon.Parent
        if not isinstance(p, StackPanel) or p.Children.Count < 2:
            return
        labels = [c for c in p.Children if isinstance(c, TextBlock) and c is not icon]
        if not labels:
            return
        owner, node = None, p
        for _ in range(5):
            node = LogicalTreeHelper.GetParent(node) if node is not None else None
            if isinstance(node, CpButtonBase):
                owner = node
                break
        if owner is not None and owner.ToolTip is None and labels[0].Text:
            self.cp_set(owner, "ToolTip", labels[0].Text)
        for lb in labels:
            self.cp_set(lb, "Visibility", Visibility.Collapsed)
        self.cp_set(icon, "Margin", Thickness(0))

    def compact_stack_header(self, g, force=False):
        """Page header "title | buttons on the right": the buttons move under the title."""
        c0, c1 = g.ColumnDefinitions[0], g.ColumnDefinitions[1]
        if not (c0.Width.IsStar and c1.Width.IsAuto):
            return
        kids0 = [c for c in g.Children if WpfGrid.GetColumn(c) == 0]
        kids1 = [c for c in g.Children if WpfGrid.GetColumn(c) == 1]
        if not kids1:
            return
        links = any(isinstance(k, StackPanel) and k.Orientation == Orientation.Horizontal and
                    len([c for c in k.Children if isinstance(c, Button) and isinstance(c.Content, basestring)
                         and len(c.Content) >= 3]) >= 2 for k in kids1)
        if not force and not links and not any(cp_has_title(k) for k in kids0):
            return
        for _ in range(2):
            rd = RowDefinition()
            rd.Height = System.Windows.GridLength.Auto
            g.RowDefinitions.Add(rd)
        self.cp["undo"].append(lambda gg=g: gg.RowDefinitions.Clear())
        for k in kids1:
            self.cp_attached(WpfGrid.SetRow, k, 1, WpfGrid.GetRow(k))
            self.cp_attached(WpfGrid.SetColumn, k, 0, 1)
            self.cp_attached(WpfGrid.SetColumnSpan, k, 2, WpfGrid.GetColumnSpan(k))
            self.cp_set(k, "Margin", Thickness(0, 6, 0, 0))
            self.cp_set(k, "HorizontalAlignment", AnnHAlign.Left)

    def compact_apply_side(self, reset=False):
        cp = getattr(self, "cp", None)
        if cp is None or not cp["on"]:
            return
        if reset:
            cp["drawer"] = False
        cur = self.cp_current_side()
        for side in (self.sideSets, self.sideTools, self.sideAnn):
            side.Visibility = Visibility.Visible if (side is cur and cp["drawer"]) else Visibility.Collapsed
        self.btnSide.Visibility = Visibility.Visible if cur is not None else Visibility.Collapsed

    def compact_toggle_drawer(self):
        self.cp["drawer"] = not self.cp["drawer"]
        self.compact_apply_side()

    def compact_item_clicked(self):
        if self.cp["on"] and self.cp["drawer"]:
            self.cp["drawer"] = False
            self.compact_apply_side()

    def compact_outside_click(self, s, e):
        cp = self.cp
        if not cp["on"] or not cp["drawer"]:
            return
        cur = self.cp_current_side()
        node = e.OriginalSource
        while node is not None:
            if node is cur or node is self.btnSide:
                return
            try:
                if isinstance(node, CpVisual):
                    node = System.Windows.Media.VisualTreeHelper.GetParent(node)
                else:
                    node = LogicalTreeHelper.GetParent(node)
            except Exception:
                break
        cp["drawer"] = False
        self.compact_apply_side()

    # ================= Ultra-compact Annotations strip =================
    def ann_bar_toggle(self):
        if self.bar["win"] is not None:
            self.ann_bar_close(True)
        else:
            self.ann_bar_open()

    def ann_bar_hover(self, bd, normal, hover):
        def val(c):
            return c() if callable(c) else c
        bd.MouseEnter += lambda s, e: setattr(bd, "Background", ann_brush(val(hover)))
        bd.MouseLeave += lambda s, e: setattr(bd, "Background", ann_brush(val(normal)))

    def ann_bar_scale(self, bd, to, ms=120, bounce=False):
        """Smooth scaling (hover / press / spring on release)."""
        try:
            st = bd.RenderTransform
            if not isinstance(st, AnScale):
                return
            da = AnDouble()
            da.To = float(to)
            da.Duration = System.Windows.Duration(TimeSpan.FromMilliseconds(ms))
            ease = AnBack() if bounce else AnCubic()
            if bounce:
                ease.Amplitude = 0.25
            ease.EasingMode = AnEasing.EaseOut
            da.EasingFunction = ease
            st.BeginAnimation(AnScale.ScaleXProperty, da)
            st.BeginAnimation(AnScale.ScaleYProperty, da.Clone())
        except Exception:
            pass

    def ann_bar_press(self, bd, action, grow=1.04):
        """Clickable Border: hover enlarge, shrink on press, spring on release."""
        bd.RenderTransform = AnScale(1.0, 1.0)
        bd.RenderTransformOrigin = System.Windows.Point(0.5, 0.5)
        state = {"down": False}

        def down(s, e):
            e.Handled = True      # so that a click does not turn into a window drag
            state["down"] = True
            self.ann_bar_scale(bd, 0.96, 70)

        def up(s, e):
            e.Handled = True
            was = state["down"]
            state["down"] = False
            self.ann_bar_scale(bd, grow, 200, True)
            if was:
                action()

        def enter(s, e):
            self.ann_bar_scale(bd, grow, 130)

        def leave(s, e):
            state["down"] = False
            self.ann_bar_scale(bd, 1.0, 170)
        bd.MouseLeftButtonDown += down
        bd.MouseLeftButtonUp += up
        bd.MouseEnter += enter
        bd.MouseLeave += leave

    def ann_bar_open(self):
        b = self.bar
        w = load_xaml(ANN_BAR_XAML)
        b["win"] = w
        for n in ("shell", "shadow", "card", "inner", "seg", "div", "pnl", "tbHint", "btnAdd", "btnMode",
                  "icMode", "lbMode", "btnBack", "row", "rightPnl", "grp", "swPnl", "btnSide", "icSide", "lbSide",
                  "gapPnl", "icGap", "btnGapDn", "btnGapUp", "icGapDn", "icGapUp", "tbGap", "lbGapMm"):
            b[n] = w.FindName(n)
        b["mode"] = self.settings.get("ann_bar_mode", "float")
        b["bg0"] = b["card"].Background
        b["theme"] = u"dark" if ann_sys_dark() else u"light"
        self.ann_bar_theme_static()
        w.Opacity = 0.0   # appears smoothly after layout (Loaded)
        area = System.Windows.SystemParameters.WorkArea
        b["pnl"].MaxWidth = max(300.0, area.Width * 0.8)
        # dragging by any empty spot of the card
        b["card"].MouseLeftButtonDown += lambda s, e: self.ann_bar_drag()
        self.ann_bar_press(b["btnAdd"], lambda: self.run(self.do_ann_from_sel, "annsel"), 1.0)
        self.ann_bar_press(b["btnBack"], lambda: self.ann_bar_close(True), 1.0)
        self.ann_bar_hover(b["btnAdd"], lambda: self.ann_bar_pal()["acc"], lambda: self.ann_bar_pal()["acc_h"])
        self.ann_bar_hover(b["btnBack"], lambda: self.ann_bar_pal()["ghost"], lambda: self.ann_bar_pal()["ghost_h"])
        self.ann_bar_press(b["btnSide"], lambda: self.ann_bar_toggle_side(), 1.0)
        self.ann_bar_press(b["btnMode"], lambda: self.ann_bar_toggle_mode(), 1.0)
        # "To geometry" offset: -/+ , wheel, manual input
        self.ann_bar_press(b["btnGapDn"], lambda: self.ann_side_gap_step(-1), 1.0)
        self.ann_bar_press(b["btnGapUp"], lambda: self.ann_side_gap_step(1), 1.0)
        self.ann_bar_hover(b["btnGapDn"], lambda: self.ann_bar_pal()["ghost"], lambda: self.ann_bar_pal()["ghost_h"])
        self.ann_bar_hover(b["btnGapUp"], lambda: self.ann_bar_pal()["ghost"], lambda: self.ann_bar_pal()["ghost_h"])
        b["gapPnl"].MouseLeftButtonDown += lambda s, e: setattr(e, "Handled", True)
        b["gapPnl"].MouseWheel += self.ann_side_gap_wheel
        b["tbGap"].KeyDown += self.ann_side_gap_key
        b["tbGap"].LostKeyboardFocus += lambda s, e: self.ann_side_gap_commit(False)
        self.ann_bar_hover(b["btnMode"], lambda: self.ann_bar_pal()["pill"], lambda: self.ann_bar_pal()["pill_h"])
        w.MouseWheel += lambda s, e: self.ann_bar_next_filter(-1 if e.Delta > 0 else 1)
        w.Loaded += lambda s, e: self.ann_bar_place_window()
        w.PreviewKeyDown += lambda s, e: self.ann_bar_key(e)
        w.Closing += lambda s, e: self.ann_bar_pre_close()
        w.Closed += lambda s, e: self.ann_bar_closed()
        w.SizeChanged += lambda s, e: self.ann_bar_size_changed()
        # the panel belongs to the Revit window: hides/minimizes together with it and does not lie over other applications
        w.Topmost = False
        try:
            WindowInteropHelper(w).Owner = uiapp.MainWindowHandle
        except Exception as ex:
            tk_log(u"ann_bar owner: {}".format(ex))
        wt = DispatcherTimer()
        wt.Interval = TimeSpan.FromMilliseconds(400)
        wt.Tick += lambda s, e: self.ann_bar_watch()
        b["wtimer"] = wt
        wt.Start()
        t = DispatcherTimer()
        t.Interval = TimeSpan.FromMilliseconds(6000)
        b["htimer"] = t

        def hide_hint(s, e):
            t.Stop()
            b["tbHint"].Visibility = Visibility.Collapsed
        t.Tick += hide_hint
        b["show_main"] = True
        b["hidden"] = False
        self.ann_bar_refresh()
        w.Show()
        self.ann_bar_sync_add(any(k not in self.ann_cfg()["favs"] for k in self.ann["sel"]))
        try:
            bar_sync()
        except Exception as ex:
            tk_log(u"ann_bar switch: {}".format(ex))

    def ann_bar_float_pos(self):
        w = self.bar["win"]
        area = System.Windows.SystemParameters.WorkArea
        pos = self.settings.get("ann_bar")
        if pos:
            left = min(max(area.Left, float(pos.get("left", 0))), max(area.Left, area.Right - 60))
            top = min(max(area.Top, float(pos.get("top", 0))), max(area.Top, area.Bottom - 40))
        else:
            left = area.Left + (area.Width - w.ActualWidth) / 2.0
            top = area.Top + 80
        return left, top

    def ann_bar_apply_mode(self):
        """floating: a capsule with a shadow; dock: a full-width strip above the taskbar, without rounding and shadows."""
        b = self.bar
        w = b["win"]
        if w is None:
            return
        area = System.Windows.SystemParameters.WorkArea
        dock = b["mode"] == "dock"
        if dock:
            b["shell"].Margin = Thickness(0)
            b["shadow"].Visibility = Visibility.Collapsed
            b["card"].CornerRadius = CornerRadius(0)
            b["card"].BorderThickness = Thickness(0, 1, 0, 0)
            self.ann_bar_paint_card()
            b["inner"].CornerRadius = CornerRadius(0)
            b["inner"].Padding = Thickness(12, 0, 12, 0)
            b["card"].MinHeight = VM_BAR_HEIGHT
            # set tabs on the left, B…K pills in the center of the strip, service buttons on the right
            b["div"].Visibility = Visibility.Collapsed
            cols = b["row"].ColumnDefinitions
            cols[0].Width = System.Windows.GridLength(1.0, System.Windows.GridUnitType.Star)
            cols[2].Width = System.Windows.GridLength(1.0, System.Windows.GridUnitType.Star)
            b["pnl"].MaxWidth = max(300.0, area.Width - 2 * 480.0)
            if not self.ann_bar_abar_apply():
                # fallback without AppBar: just above the taskbar
                h = self.ann_bar_dock_height(area.Width)
                self.ann_bar_dock_place(area.Left, area.Bottom - h, area.Width, h)
            b["icMode"].Text = u"\uE718"
            b["lbMode"].Text = u"Docked"
            b["btnMode"].ToolTip = u"The panel is docked at the bottom and reserves space now (Revit does not overlap it). Click to make it floating"
        else:
            self.ann_bar_abar_remove()
            cols = b["row"].ColumnDefinitions
            for i in (0, 1, 2):
                cols[i].Width = System.Windows.GridLength.Auto
            b["div"].Visibility = Visibility.Visible
            b["shell"].Margin = Thickness(16, 12, 16, 22)
            b["shadow"].Visibility = Visibility.Visible
            b["card"].CornerRadius = CornerRadius(19)
            b["card"].BorderThickness = Thickness(1)
            self.ann_bar_paint_card()
            b["inner"].CornerRadius = CornerRadius(18)
            b["inner"].Padding = Thickness(7, 4, 6, 4)
            b["card"].MinHeight = 0.0
            b["pnl"].MaxWidth = max(300.0, area.Width * 0.8)
            w.MinWidth = 0.0
            w.Width = float("nan")
            w.Height = float("nan")
            w.SizeToContent = System.Windows.SizeToContent.WidthAndHeight
            w.UpdateLayout()
            left, top = self.ann_bar_float_pos()
            w.Left, w.Top = left, top
            b["icMode"].Text = u"\uE8A7"
            b["lbMode"].Text = u"Floating"
            b["btnMode"].ToolTip = u"The panel is floating now. Click to dock it above the taskbar at full width"

    def ann_bar_set_top(self, top):
        """Docked strip: rounded top corners if it is the top one in the stack of strips."""
        b = getattr(self, "bar", None)
        if not b or b.get("win") is None:
            return
        b["top"] = bool(top)
        if b.get("mode") != "dock":
            return
        if top:
            b["card"].CornerRadius = CornerRadius(20, 20, 0, 0)
            b["card"].BorderThickness = Thickness(1, 1, 1, 0)
            b["inner"].CornerRadius = CornerRadius(19, 19, 0, 0)
        else:
            b["card"].CornerRadius = CornerRadius(0)
            b["card"].BorderThickness = Thickness(0, 1, 0, 0)
            b["inner"].CornerRadius = CornerRadius(0)

    def ann_bar_abar_apply(self):
        """Register/update an AppBar strip at the bottom of the screen (above the taskbar) via the shared manager. True - succeeded."""
        b = self.bar
        w = b.get("win")
        if w is None or ABAR_DATA is None:
            return False
        try:
            ok = abar_set("ann", 0, w, self.ann_bar_dock_height, self.ann_bar_dock_place, self.ann_bar_set_top)
        except Exception as ex:
            tk_log(u"ann_bar appbar: {}".format(ex))
            ok = False
        b["abar"] = bool(ok)
        return bool(ok)

    def ann_bar_pal(self):
        return ANN_BAR_PAL.get(self.bar.get("theme") or u"light", ANN_BAR_PAL[u"light"])

    def ann_bar_paint_card(self):
        b = self.bar
        pal = self.ann_bar_pal()
        if b.get("mode") == "dock":
            b["card"].BorderBrush = ann_brush(pal["border_d"])
            b["card"].Background = ann_brush(pal["card_d"])
        else:
            b["card"].BorderBrush = ann_brush(pal["border_f"])
            b["card"].Background = b["bg0"] if pal["card_f"] is None else ann_brush(pal["card_f"])

    def ann_bar_theme_static(self):
        b = self.bar
        pal = self.ann_bar_pal()
        b["shadow"].Background = ann_brush(pal["shadow"])
        b["div"].Background = ann_brush(pal["div"])
        b["tbHint"].Foreground = ann_brush(pal["hint"])
        b["btnMode"].Background = ann_brush(pal["pill"])
        b["btnBack"].Background = ann_brush(pal["ghost"])
        b["icMode"].Foreground = ann_brush(pal["pill_t"])
        b["lbMode"].Foreground = ann_brush(pal["pill_t"])
        b["btnAdd"].Background = ann_brush(pal["acc"])
        try:
            b["btnBack"].Child.Foreground = ann_brush(pal["hint"])
        except Exception:
            pass
        try:
            self.ann_bar_side_paint()
        except Exception as ex:
            tk_log(u"ann_bar side paint: {}".format(ex))

    def ann_bar_apply_theme(self):
        """The Windows theme changed - recolor the panel (without changing the position)."""
        b = self.bar
        if b.get("win") is None:
            return
        t = u"dark" if ann_sys_dark() else u"light"
        if t == b.get("theme"):
            return
        b["theme"] = t
        self.ann_bar_theme_static()
        self.ann_bar_paint_card()
        self.ann_bar_refresh()
        try:
            if _VM[0] is not None:
                _VM[0].apply_theme()
        except Exception as ex:
            tk_log(u"ann_bar theme vm: {}".format(ex))

    def ann_bar_dock_height(self, width):
        """Strip height at a given width (DIP) - we measure the content, not relying on SizeToContent."""
        sh = self.bar["shell"]
        sh.Measure(System.Windows.Size(float(width), float("inf")))
        return float(sh.DesiredSize.Height)

    def ann_bar_dock_place(self, left, top, width, height):
        w = self.bar["win"]
        w.SizeToContent = System.Windows.SizeToContent.Manual
        old = None
        try:
            if w.IsVisible and w.Opacity > 0.5:
                old = float(w.Top)
        except Exception:
            old = None
        w.MinWidth = float(width)
        w.Width = float(width)
        w.Height = float(height)
        w.Left = float(left)
        w.Top = float(top)
        if old is not None:
            slide_top(w, old, float(top))

    def ann_bar_abar_remove(self):
        b = self.bar
        if not b.get("abar"):
            return
        b["abar"] = False
        abar_drop("ann")

    def ann_bar_size_changed(self):
        b = self.bar
        if b.get("win") is not None and b.get("mode") == "dock" and b.get("abar") and not ABAR_STATE["busy"]:
            try:
                w = b["win"]
                if abs(self.ann_bar_dock_height(w.Width) - w.Height) <= 1.0:
                    return
            except Exception:
                pass
            self.ann_bar_abar_apply()

    def ann_bar_watch(self):
        """Revit was minimized - we release the reserved space; restored - we set it back."""
        b = self.bar
        if b.get("win") is None:
            return
        b["tick"] = b.get("tick", 0) + 1
        try:
            if b.get("side") and ann_caps_on() != b.get("caps"):
                self.ann_bar_side_paint()
        except Exception:
            pass
        if b.get("active"):
            return          # placement is in progress: we skip the heavy part (theme, AppBar, layout)
        if b["tick"] % 5 == 0:
            try:
                self.ann_bar_apply_theme()
            except Exception as ex:
                tk_log(u"ann_bar theme: {}".format(ex))
            bars_layout_update()
        if b.get("hidden"):
            return
        try:
            import ctypes
            iconic = bool(ctypes.windll.user32.IsIconic(ctypes.c_void_p(uiapp.MainWindowHandle.ToInt64())))
        except Exception:
            return
        if iconic:
            if b.get("abar"):
                self.ann_bar_abar_remove()
                b["abar_susp"] = True
        elif b.get("abar_susp"):
            b["abar_susp"] = False
            if b.get("mode") == "dock":
                self.ann_bar_apply_mode()
        elif b.get("mode") == "dock" and b.get("abar") and not b.get("abar_busy"):
            try:
                w = b["win"]
                if abs(self.ann_bar_dock_height(w.Width) - w.Height) > 1.0:
                    self.ann_bar_abar_apply()
                else:
                    abar_check()
            except Exception:
                pass

    def ann_bar_hide(self):
        """Hide the Annotations strip without closing it: release the reserved space and hide the window."""
        b = self.bar
        w = b.get("win")
        if w is None or b.get("hidden"):
            return
        if b.get("mode") != "dock":
            try:
                self.settings["ann_bar"] = {"left": w.Left, "top": w.Top}
                save_settings(self.settings)
            except Exception:
                pass
        vm = _VM[0]
        if vm is not None and vm.merged:       # the View Creation panel returns to its own strip
            try:
                vm.unmerge(False)
            except Exception as ex:
                tk_log(u"ann_bar_hide unmerge: {}".format(ex))
        b["hidden"] = True
        b["abar_susp"] = False

        def fin():
            if not b.get("hidden") or b.get("win") is not w:
                return
            self.ann_bar_abar_remove()
            try:
                w.Hide()
            except Exception:
                pass
        fade_win(w, 0.0, 150, fin)

    def ann_bar_unhide(self):
        b = self.bar
        w = b.get("win")
        if w is None or not b.get("hidden"):
            return
        b["hidden"] = False
        try:
            w.Show()
        except Exception:
            pass
        self.ann_bar_apply_mode()
        fade_win(w, 1.0, 190, None, 0.0)

    def ann_bar_sw_paint(self, state=None):
        """Strip switch: two toggle icons (View Creation, Annotations). Both on = "Both".
        Lives only here (the bottom strip); in View Creation it appears only when that strip is the only one."""
        b = self.bar
        sp = b.get("swPnl")
        if sp is None or b.get("win") is None:
            return
        if state is None:
            state = bar_state()
        pal = self.ann_bar_pal()
        on = {u"vm": state in (u"vm", u"both"), u"ann": state in (u"ann", u"both")}
        last = state in (u"vm", u"ann")        # the only visible strip - we do not turn it off
        sp.Children.Clear()
        for key, glyph, tip in BAR_SW_ITEMS:
            sel = on[key]
            bd = Border()
            bd.CornerRadius = CornerRadius(13)
            bd.Width = 28.0
            bd.Height = 26.0
            bd.Margin = Thickness(2, 0, 2, 0)
            bd.Cursor = AnnCursors.Hand
            bd.ToolTip = tip
            tb = TextBlock()
            tb.Text = glyph
            tb.FontFamily = ICON_FONT
            tb.FontSize = 13.0
            tb.HorizontalAlignment = System.Windows.HorizontalAlignment.Center
            tb.VerticalAlignment = VerticalAlignment.Center
            tb.Foreground = ann_brush(pal["seg_sel_t"] if sel else pal["pill_t"])
            bd.Child = tb
            if sel:
                bd.Background = ann_brush(pal["seg_sel_bg"])
            else:
                bd.Background = ann_brush(pal["pill"])
                self.ann_bar_hover(bd, pal["pill"], pal["pill_h"])
            if sel and last:
                bd.MouseLeftButtonDown += self.on_swallow
            else:
                self.ann_bar_press(bd, lambda k=key: bar_toggle(k), 1.0)
            sp.Children.Add(bd)

    def ann_bar_pre_close(self):
        b = self.bar
        try:
            vm = _VM[0]
            if vm is not None and vm.merged:
                vm.unmerge(False)
        except Exception as ex:
            tk_log(u"ann_bar pre_close unmerge: {}".format(ex))
        try:
            self.ann_side_hook_off()
            b["side_key"] = None
        except Exception:
            pass
        try:
            b["wtimer"].Stop()
        except Exception:
            pass
        self.ann_bar_abar_remove()

    def ann_bar_toggle_mode(self):
        b = self.bar
        w = b["win"]
        if w is None:
            return
        if b["mode"] == "float":
            self.settings["ann_bar"] = {"left": w.Left, "top": w.Top}
            b["mode"] = "dock"
        else:
            b["mode"] = "float"
        self.settings["ann_bar_mode"] = b["mode"]
        save_settings(self.settings)
        self.ann_bar_apply_mode()
        bars_layout_update()

    def ann_bar_place_window(self):
        w = self.bar["win"]
        if w is None:
            return
        self.ann_bar_apply_mode()
        try:  # smooth appearance
            anim = AnDouble(0.0, 1.0, System.Windows.Duration(TimeSpan.FromMilliseconds(190)))
            w.BeginAnimation(System.Windows.UIElement.OpacityProperty, anim)
        except Exception:
            w.Opacity = 1.0

    def ann_bar_drag(self):
        if self.bar.get("mode") == "dock":
            return
        try:
            self.bar["win"].DragMove()
        except Exception:
            pass

    def ann_bar_close(self, show_main=True):
        b = self.bar
        w = b["win"]
        if w is None:
            return
        b["show_main"] = show_main
        w.Close()

    def ann_bar_closed(self):
        b = self.bar
        w = b["win"]
        if w is not None:
            try:
                if b.get("mode") != "dock":
                    self.settings["ann_bar"] = {"left": w.Left, "top": w.Top}
                save_settings(self.settings)
            except Exception:
                pass
        try:
            b["htimer"].Stop()
        except Exception:
            pass
        self.ann_bar_pre_close()
        b["win"] = None
        b["btns"] = {}
        b["active"] = None
        if b.get("show_main", True) and not self.closed and not getattr(self, "_mini", False):
            try:
                if not self.win.IsVisible:
                    self.win.Show()
            except Exception:
                pass
        b["show_main"] = True
        b["hidden"] = False
        try:
            bar_after_close(u"ann")
        except Exception as ex:
            tk_log(u"ann_bar closed sync: {}".format(ex))

    def ann_bar_filters(self):
        filters = [ANN_FAV] + [st["name"] for st in self.ann_cfg()["sets"]]
        if self.ann.get("groups"):
            filters.append(u"Groups")
        return filters

    def ann_bar_next_filter(self, step):
        b = self.bar
        if b["win"] is None:
            return
        flt = self.ann_bar_filters()
        if len(flt) < 2:
            return
        i = flt.index(b["filter"]) if b["filter"] in flt else 0
        b["filter"] = flt[(i + step) % len(flt)]
        self.ann_bar_refresh()

    def ann_bar_hint(self, msg):
        b = getattr(self, "bar", None)
        if not b or b["win"] is None or not msg:
            return
        try:
            tb = b["tbHint"]
            tb.Text = msg
            tb.ToolTip = msg
            tb.Visibility = Visibility.Visible
            b["htimer"].Stop()
            b["htimer"].Start()
        except Exception:
            pass

    def ann_bar_sync_add(self, has_new):
        b = getattr(self, "bar", None)
        if not b or b["win"] is None:
            return
        b["btnAdd"].Visibility = Visibility.Visible if has_new else Visibility.Collapsed

    def ann_bar_style(self, bd, tb, state):
        pal = self.ann_bar_pal()
        if state == "a":
            bd.Background = ann_brush(pal["seg_sel_bg"])
            tb.Foreground = ann_brush(pal["seg_sel_t"])
        else:
            bd.Background = ann_brush(pal["pill_h"] if state == "h" else pal["pill"])
            tb.Foreground = ann_brush(pal["pill_t"])

    def ann_bar_set_active(self, key):
        b = getattr(self, "bar", None)
        if not b:
            return
        b["active"] = key
        for k, (bd, tb) in b["btns"].items():
            self.ann_bar_style(bd, tb, "a" if k == key else "n")

    def ann_bar_seg(self, flt, label, count, selected):
        """Category tab: no "trough", the selected one - a tinted capsule background (as in macOS).
        For sets (not ANN_FAV) to the right of the tab — a small '▶' button (insert all)."""
        b = self.bar
        is_set = (flt != ANN_FAV)
        # wrapper: a horizontal stack [tab] + [▶ if a set]
        wrapper = StackPanel()
        wrapper.Orientation = Orientation.Horizontal

        bd = Border()
        bd.CornerRadius = CornerRadius(13)
        bd.Height = 26.0
        bd.Padding = Thickness(10, 0, 10, 0)
        bd.Margin = Thickness(2, 0, 0, 0)
        bd.Cursor = AnnCursors.Hand
        bd.ToolTip = u"{}: {}".format(label, count)
        sp = StackPanel()
        sp.Orientation = Orientation.Horizontal
        if flt == ANN_FAV:
            ic = TextBlock()
            ic.Text = u"\uE735"
            ic.FontFamily = ICON_FONT
            ic.FontSize = 12
            ic.Foreground = isl_brush("#FFB000")
            ic.VerticalAlignment = VerticalAlignment.Center
            ic.Margin = Thickness(0, 0, 6, 0)
            sp.Children.Add(ic)
        tb = TextBlock()
        tb.Text = label
        tb.MaxWidth = 130
        tb.TextTrimming = TextTrimming.CharacterEllipsis
        tb.VerticalAlignment = VerticalAlignment.Center
        pal = self.ann_bar_pal()
        tb.Foreground = ann_brush(pal["seg_sel_t"] if selected else pal["pill_t"])
        sp.Children.Add(tb)
        bd.Child = sp
        if selected:
            bd.Background = ann_brush(pal["seg_sel_bg"])
        else:
            bd.Background = ann_brush(pal["pill"])
            self.ann_bar_hover(bd, pal["pill"], pal["pill_h"])

            def pick(f=flt):
                b["filter"] = f
                self.ann_bar_refresh()
            self.ann_bar_press(bd, pick, 1.0)
        wrapper.Children.Add(bd)

        # the ▶ button "Insert all from the set" — appears only for sets (not Favorites)
        if is_set and count > 0:
            play = Border()
            play.CornerRadius = CornerRadius(13)
            play.Height = 26.0
            play.Padding = Thickness(8, 0, 8, 0)
            play.Margin = Thickness(2, 0, 2, 0)
            play.Cursor = AnnCursors.Hand
            play.ToolTip = u"Insert all {} annotations of the set \"{}\" one by one".format(count, label)
            play_sp = StackPanel()
            play_sp.Orientation = Orientation.Horizontal
            play_ic = TextBlock()
            play_ic.Text = u"\u25B6"   # ▶
            play_ic.FontSize = 9
            play_ic.VerticalAlignment = VerticalAlignment.Center
            play_ic.Margin = Thickness(0, 0, 5, 0)
            play_sp.Children.Add(play_ic)
            play_tb = TextBlock()
            play_tb.Text = u"All"
            play_tb.VerticalAlignment = VerticalAlignment.Center
            play_sp.Children.Add(play_tb)
            play.Child = play_sp
            play.Background = ann_brush(pal["seg_sel_bg"] if selected else pal["pill"])
            play_ic.Foreground = ann_brush(pal["seg_sel_t"] if selected else pal["pill_t"])
            play_tb.Foreground = ann_brush(pal["seg_sel_t"] if selected else pal["pill_t"])
            self.ann_bar_hover(play, pal["pill"], pal["pill_h"])
            self.ann_bar_press(play, lambda f=flt: self.ann_place_set(f), 1.0)
            wrapper.Children.Add(play)
        else:
            # if the set is empty or it is favorites — margin
            bd.Margin = Thickness(2, 0, 2, 0)

        return wrapper

    def ann_bar_drag_setup(self, bd):
        """Dragging a pill changes the order (live reordering); an ordinary click works as before."""
        b = self.bar
        st = {"down": None, "on": False}
        pressed = System.Windows.Input.MouseButtonState.Pressed

        def down(s, e):
            st["down"] = e.GetPosition(b["pnl"])
            st["on"] = False

        def move(s, e):
            if st["down"] is None:
                return
            if e.LeftButton != pressed:
                st["down"] = None
                return
            pnl = b["pnl"]
            pos = e.GetPosition(pnl)
            if not st["on"]:
                if abs(pos.X - st["down"].X) < 6 and abs(pos.Y - st["down"].Y) < 6:
                    return
                st["on"] = True
                bd.CaptureMouse()
                bd.Opacity = 0.6
                bd.Cursor = AnnCursors.SizeAll
            kids = [c for c in pnl.Children]
            if bd not in kids:
                return
            i = kids.index(bd)
            for j, ch in enumerate(kids):
                if j == i:
                    continue
                pt = ch.TranslatePoint(System.Windows.Point(0, 0), pnl)
                r = System.Windows.Rect(pt.X, pt.Y, ch.ActualWidth, ch.ActualHeight)
                if r.Contains(pos):
                    cx = pt.X + ch.ActualWidth / 2.0
                    if (j > i and pos.X > cx) or (j < i and pos.X < cx):
                        pnl.Children.Remove(bd)
                        pnl.Children.Insert(j, bd)
                    break

        def up(s, e):
            was = st["on"]
            st["down"] = None
            st["on"] = False
            if was:
                e.Handled = True      # it was a drag, not a click - we do not place the annotation
                try:
                    bd.ReleaseMouseCapture()
                except Exception:
                    pass
                self.ann_bar_reorder_commit()
        bd.PreviewMouseLeftButtonDown += down
        bd.PreviewMouseMove += move
        bd.PreviewMouseLeftButtonUp += up

    def ann_bar_reorder_commit(self):
        """Write the new pill order to favorites/set (hidden keys stay in their places)."""
        b = self.bar
        try:
            order = [c.Tag for c in b["pnl"].Children if getattr(c, "Tag", None) is not None]
            cfg = self.ann_cfg()
            if b["filter"] == ANN_FAV:
                lst = cfg["favs"]
            else:
                stt = self.ann_set_get(b["filter"])
                lst = stt["keys"] if stt else None
            if lst is not None and order:
                shown = set(order)
                it = iter(order)
                res = [(next(it) if k in shown else k) for k in lst]
                if len(res) == len(lst):
                    lst[:] = res
                    self.ann_save()
        except Exception as ex:
            tk_log(u"ann_bar reorder: {}".format(ex))
        try:
            self.ann_render()          # updates both the main window and the panel
        except Exception:
            self.ann_bar_refresh()

    def ann_bar_btn(self, it, note):
        a = self.ann
        b = self.bar
        key = it["key"]
        present = it["present"]
        bd = Border()
        bd.CornerRadius = CornerRadius(13)
        bd.Height = 26.0
        bd.Padding = Thickness(11, 0, 11, 0)
        bd.Margin = Thickness(2, 0, 2, 0)
        bd.Cursor = AnnCursors.Hand if present else AnnCursors.Arrow
        bd.Opacity = 1.0 if present else 0.4
        tip = u"{}\n{}".format(it["fam"], it["typ"])
        if note:
            tip += u"\n\n" + note
        wasd = key in self.ann_cfg()["wasd"]
        tip += u"\n\nClick - place in the view" if present else u"\n\nNot in this project"
        tip += u"\nDrag - change the order"
        tip += (u"\nDot = WASD mode (Caps Lock on - to geometry, off - standard). Right-click - always standard"
                if wasd else u"\nRight-click - place in WASD mode (a dot will appear)")
        bd.ToolTip = tip
        bd.Tag = key
        self.ann_bar_drag_setup(bd)
        sp = StackPanel()
        sp.Orientation = Orientation.Horizontal
        img = a["img"].get(key)
        if img:
            im = AnnImage()
            im.Source = img
            im.Width = 18
            im.Height = 18
            im.Stretch = AnnStretch.Uniform
            im.Margin = Thickness(-2, 0, 7, 0)
            sp.Children.Add(im)
        tb = TextBlock()
        tb.Text = it["typ"]
        tb.MaxWidth = 170
        tb.TextTrimming = TextTrimming.CharacterEllipsis
        tb.VerticalAlignment = VerticalAlignment.Center
        sp.Children.Add(tb)
        if wasd:
            gr = System.Windows.Controls.Grid()
            gr.Children.Add(sp)
            dot = WEllipse()
            dot.Width = 6.0
            dot.Height = 6.0
            dot.Fill = ann_brush(self.ann_bar_pal()["wasd_dot"])
            dot.HorizontalAlignment = System.Windows.HorizontalAlignment.Right
            dot.VerticalAlignment = VerticalAlignment.Top
            dot.Margin = Thickness(0, -1, -7, 0)
            dot.IsHitTestVisible = False
            gr.Children.Add(dot)
            bd.Child = gr
        else:
            bd.Child = sp
        bd.MouseRightButtonUp += lambda s, e, k=key: (setattr(e, "Handled", True), self.ann_wasd_toggle(k))
        self.ann_bar_style(bd, tb, "a" if b["active"] == key else "n")
        if present:
            def enter(s, e):
                if b["active"] != key:
                    self.ann_bar_style(bd, tb, "h")

            def leave(s, e):
                self.ann_bar_style(bd, tb, "a" if b["active"] == key else "n")
            bd.MouseEnter += enter
            bd.MouseLeave += leave
            self.ann_bar_press(bd, lambda k=key: self.ann_place(k), 1.0)
        else:
            bd.MouseLeftButtonDown += self.on_swallow
        b["btns"][key] = (bd, tb)
        return bd

    def ann_bar_group_btn(self, g):
        bd = Border()
        bd.CornerRadius = CornerRadius(13)
        bd.Height = 26.0
        bd.Padding = Thickness(11, 0, 11, 0)
        bd.Margin = Thickness(2, 0, 2, 0)
        bd.Cursor = AnnCursors.Hand
        bd.ToolTip = u"Group \"{}\"\nClick — insert into the view (pick a point)".format(g["name"])
        bd.Background = ann_brush(self.ann_bar_pal()["pill"])
        sp = StackPanel()
        sp.Orientation = Orientation.Horizontal
        ic = TextBlock()
        ic.Text = u"📦 "
        ic.FontSize = 11
        ic.VerticalAlignment = VerticalAlignment.Center
        sp.Children.Add(ic)
        tb = TextBlock()
        tb.Text = g["name"]
        tb.MaxWidth = 170
        tb.TextTrimming = TextTrimming.CharacterEllipsis
        tb.VerticalAlignment = VerticalAlignment.Center
        tb.Foreground = ann_brush(self.ann_bar_pal()["pill_t"])
        sp.Children.Add(tb)
        bd.Child = sp
        self.ann_bar_press(bd, lambda gid=g["id"]: self.ann_place_group(gid), 1.0)
        return bd

    def ann_bar_refresh(self):
        b = getattr(self, "bar", None)
        if not b or b["win"] is None:
            return
        a = self.ann
        cfg = self.ann_cfg()
        favs, cats, notes = cfg["favs"], cfg["cats"], cfg["notes"]
        filters = self.ann_bar_filters()
        if b["filter"] not in filters:
            b["filter"] = ANN_FAV

        def members(flt):
            if flt == ANN_FAV:
                return [a["by"][k] for k in favs if k in a["by"]]
            if flt == u"Groups":
                return a.get("groups", [])
            st = self.ann_set_get(flt)
            return [a["by"][k] for k in (st["keys"] if st else []) if k in a["by"]]

        b["seg"].Children.Clear()
        for flt in filters:
            b["seg"].Children.Add(self.ann_bar_seg(flt, u"Favorites" if flt == ANN_FAV else flt,
                                                   len(members(flt)), flt == b["filter"]))
        pnl = b["pnl"]
        pnl.Children.Clear()
        b["btns"] = {}
        if b["filter"] == u"Groups":
            groups = a.get("groups", [])
            for g in groups:
                pnl.Children.Add(self.ann_bar_group_btn(g))
            if not groups:
                hint = TextBlock()
                hint.Text = u"No groups yet: select annotations in Revit and click \"Save as group\""
                hint.Foreground = isl_brush("#8E8E93")
                hint.Margin = Thickness(4, 0, 4, 0)
                hint.VerticalAlignment = VerticalAlignment.Center
                pnl.Children.Add(hint)
        else:
            items = members(b["filter"])
            for it in items:
                pnl.Children.Add(self.ann_bar_btn(it, notes.get(it["key"], u"")))
            if not items:
                hint = TextBlock()
                hint.Text = (u"Empty: add favorites (\u2605) on the Annotations tab in Toolkit" if b["filter"] == ANN_FAV
                             else u"The set is empty: add annotations via \u270E on the Annotations tab in Toolkit")
                hint.Foreground = isl_brush("#8E8E93")
                hint.Margin = Thickness(4, 0, 4, 0)
                hint.VerticalAlignment = VerticalAlignment.Center
                pnl.Children.Add(hint)
        self.ann_bar_set_active(b.get("active"))
        self.ann_bar_side_paint()
        self.ann_update_banner()
        try:
            self.ann_bar_sw_paint()
        except Exception as ex:
            tk_log(u"ann_bar sw_paint: {}".format(ex))
        bars_layout_update()      # the annotation set changed width - check whether there is enough room for the merged strip

    # ================= Annotations =================
    def ann_cfg(self):
        c = self.ann_store
        c.setdefault("favs", [])
        c.setdefault("notes", {})
        c.setdefault("cats", {})
        c.setdefault("collapsed", [])
        c.setdefault("src", 0)
        c.setdefault("sets", [])
        c.setdefault("wasd", [])      # annotation types placed in the "To geometry" mode (WASD)
        return c

    def ann_save(self):
        if not save_ann_store(self.ann_store):
            self.set_status(u"Could not save favorites (see the Toolkit log).")

    def ann_setup(self):
        self.ann = {"items": [], "by": {}, "doc": None, "loaded": False, "filter": ANN_ALL,
                    "img": {}, "imgs": {}, "pq": [], "edit": None, "navbusy": False,
                    "deferred": [], "sel": [], "sel_sig": None,
                    "setmode": None, "setdel": False, "msel": set(),
                    "groups": [], "sel_ids": []}
        cfg = self.ann_cfg()
        for name, mode in ANN_SOURCES:
            self.cbAnnSrc.Items.Add(name)
        idx = cfg.get("src", 0)
        self.cbAnnSrc.SelectedIndex = idx if 0 <= idx < len(ANN_SOURCES) else 0
        self.cbAnnSrc.SelectionChanged += lambda s, e: self.on_ann_src()
        bind_hint(self.tbAnnSearch, self.hAnnSearch)
        bind_hint(self.tbAnnNote, self.hAnnNote)
        self._ann_search_timer = DispatcherTimer()
        self._ann_search_timer.Interval = TimeSpan.FromMilliseconds(180)

        def search_fire(s2, e2):
            self._ann_search_timer.Stop()
            self.ann_render()
        self._ann_search_timer.Tick += search_fire
        self.tbAnnSearch.TextChanged += lambda s, e: (self._ann_search_timer.Stop(), self._ann_search_timer.Start())
        self.lstAnnNav.SelectionChanged += lambda s, e: self.on_ann_nav()
        self.btnAnnFromSel.Click += lambda s, e: self.run(self.do_ann_from_sel, "annsel")
        self.btnAnnEditSave.Click += lambda s, e: self.ann_edit_save()
        self.btnAnnEditClose.Click += lambda s, e: self.ann_edit_close()
        self.btnAnnEditFav.Click += lambda s, e: self.ann_edit_fav()
        self.btnAnnEditWasd.Click += lambda s, e: self.ann["edit"] and self.ann_wasd_toggle(self.ann["edit"])
        self.btnAnnSelAdd.Click += lambda s, e: self.ann_sel_add_clicked()
        self.btnAnnSaveGroupSel.Click += lambda s, e: self.on_ann_save_group_click()
        self.btnAnnDoSaveGroup.Click += lambda s, e: self.on_ann_do_save_group()
        self.btnAnnCancelSaveGroup.Click += lambda s, e: setattr(self.cardAnnCreateGroup, "Visibility", Visibility.Collapsed)
        self.tbAnnNewGroupName.KeyDown += lambda s, e: self.on_ann_new_group_key(e)
        self.btnAnnMSelFav.Click += lambda s, e: self.ann_msel_save_favs()
        self.btnAnnMSelSet.Click += lambda s, e: self.ann_msel_save_set()
        self.btnAnnMSelClear.Click += lambda s, e: self.ann_msel_clear()
        self.bar = {"win": None, "filter": ANN_FAV, "active": None, "btns": {}, "show_main": True,
                    "side": True, "side_key": None, "side_last": {}, "hook": None}
        self.btnAnnBar.Click += lambda s, e: self.ann_bar_toggle()
        self.btnAnnSetNew.Click += lambda s, e: self.ann_set_new()
        self.btnAnnSetSave.Click += lambda s, e: self.ann_set_save()
        self.btnAnnSetDelete.Click += lambda s, e: self.ann_set_delete()
        self.tbAnnSetName.KeyDown += lambda s, e: self.ann_set_key(e)
        # the preview and selection are moved by UI-thread timers: Raise() from inside Execute is unreliable
        self._ann_ptimer = DispatcherTimer()
        self._ann_ptimer.Interval = TimeSpan.FromMilliseconds(150)
        self._ann_ptimer.Tick += lambda s, e: self.ann_prev_tick()
        self._ann_stimer = DispatcherTimer()
        self._ann_stimer.Interval = TimeSpan.FromMilliseconds(700)
        self._ann_stimer.Tick += lambda s, e: self.ann_poll_tick()
        self._ann_stimer.Start()
        self._home_n = 0
        self._home_timer = DispatcherTimer()
        self._home_timer.Interval = TimeSpan.FromMilliseconds(1500)
        self._home_timer.Tick += lambda s, e: self.home_tick()
        self._home_timer.Start()
        self.ann_show_empty(u"Open the tab to load the annotations of the current model.")

    def ann_show_empty(self, text):
        self.tbAnnEmpty.Text = text or u""
        self.tbAnnEmpty.Visibility = Visibility.Visible if text else Visibility.Collapsed

    def ann_reload(self):
        try:
            self.bar.get("ext_cache", {}).clear()
        except Exception:
            pass
        self.ann["loaded"] = False
        self.run(self.do_ann_first, "annfirst")

    def on_ann_src(self):
        idx = self.cbAnnSrc.SelectedIndex
        if idx < 0:
            return
        self.ann_cfg()["src"] = idx
        self.ann_save()
        if self.tab == 5:
            self.ann_reload()

    def on_ann_nav(self):
        if self.ann["navbusy"]:
            return
        item = self.lstAnnNav.SelectedItem
        if item is None or item.Tag is None:
            return
        self.ann["filter"] = item.Tag
        self.ann["msel"].clear()   # when the filter changes we reset the group selection
        self.ann["setmode"] = None
        self.ann["setdel"] = False
        self.ann_render()

    # ---------- reading the model (Revit context) ----------
    def do_ann_first(self, uiapp):
        uidoc = uiapp.ActiveUIDocument
        title = uidoc.Document.Title if uidoc is not None else None
        if not self.ann["loaded"] or self.ann["doc"] != title:
            self.do_ann_load(uiapp)
        elif self.ann["deferred"] and not ann_bad_view(uidoc.ActiveView):
            self.ann["pq"] = list(self.ann["deferred"])
            self.ann["deferred"] = []
            self.ann_start_previews()

    def do_ann_load(self, uiapp):
        uidoc = uiapp.ActiveUIDocument
        a = self.ann
        if uidoc is None:
            a["items"], a["by"] = [], {}
            self.ann_render()
            self.ann_show_empty(u"No project is open.")
            return
        doc = uidoc.Document
        cfg = self.ann_cfg()
        favs = list(cfg["favs"])
        idx = self.cbAnnSrc.SelectedIndex
        mode = ANN_SOURCES[idx if 0 <= idx < len(ANN_SOURCES) else 0][1]
        if a["doc"] != doc.Title:
            a["img"] = {}
        items, seen = [], set()
        for sym in FilteredElementCollector(doc).OfClass(FamilySymbol):
            try:
                key = ann_key(sym)
                insrc = ann_cat_matches(sym, mode)
                if not insrc and key not in favs:
                    continue
                if key in seen:
                    continue
                seen.add(key)
                fam, typ = ann_split_key(key)
                items.append({"key": key, "fam": fam, "typ": typ, "rcat": sym.Category.Name if sym.Category else u"",
                              "eid": sym.Id, "present": True, "insrc": insrc})
            except Exception:
                continue
        for key in favs:
            if key not in seen:
                fam, typ = ann_split_key(key)
                items.append({"key": key, "fam": fam, "typ": typ, "rcat": u"", "eid": None,
                              "present": False, "insrc": False})
        a["items"] = items
        a["by"] = dict((it["key"], it) for it in items)
        a["doc"] = doc.Title
        a["loaded"] = True
        pq = []
        for it in items:
            if it["present"] and it["key"] not in a["img"]:
                cached = ann_cache_load(doc.Title, it["key"])
                if cached is not None:
                    a["img"][it["key"]] = cached
                else:
                    pq.append(it["key"])
        a["pq"] = pq
        a["deferred"] = []
        self.ann_load_groups(doc)
        self.ann_render()
        if a["pq"]:
            self.ann_start_previews()

    def ann_start_previews(self):
        if not self._ann_ptimer.IsEnabled:
            self._ann_ptimer.Start()

    def ann_prev_tick(self):
        if self.closed or not self.ann["pq"]:
            self._ann_ptimer.Stop()
            return
        self.run(self.do_ann_previews, "annprev")

    def ann_poll_tick(self):
        if self.closed or self.tab != 5 or self.tools_busy:
            return
        self.run(self.do_ann_poll, "annpoll")

    def ann_set_image(self, key, img):
        self.ann["img"][key] = img if img is not None else False
        if img is not None:
            if self.ann.get("doc"):
                ann_cache_save(self.ann["doc"], key, img)
            for image, glyph in self.ann["imgs"].get(key, []):
                image.Source = img
                glyph.Visibility = Visibility.Collapsed

    def do_ann_previews(self, uiapp):
        """Previews in batches: the stored Revit preview, and if there is none - a vector one from the annotation geometry."""
        a = self.ann
        uidoc = uiapp.ActiveUIDocument
        if uidoc is None or uidoc.Document.Title != a["doc"]:
            a["pq"] = []
            return
        doc = uidoc.Document
        view = uidoc.ActiveView
        can_temp = not ann_bad_view(view)
        t0 = time.time()
        temp = None
        try:
            while a["pq"] and time.time() - t0 < 0.15:
                key = a["pq"][0]
                it = a["by"].get(key)
                if it is None or it["eid"] is None:
                    a["pq"].pop(0)
                    continue
                sym = doc.GetElement(it["eid"])
                if sym is None:
                    a["pq"].pop(0)
                    continue
                img = ann_preview(sym)
                if img is None:
                    if not can_temp:
                        a["pq"].pop(0)
                        a["deferred"].append(key)
                        continue
                    if temp is None:
                        tr = Transaction(doc, u"Annotation previews")
                        try:
                            tr.Start()
                            temp = tr
                        except Exception as ex:
                            ann_log_once(u"transaction", ex)
                            can_temp = False
                            continue
                    img = ann_draw_preview(ann_geom_temp(doc, view, sym))
                a["pq"].pop(0)
                self.ann_set_image(key, img)
        finally:
            if temp is not None:
                try:
                    temp.RollBack()
                except Exception as ex:
                    ann_log_once(u"rollback", ex)
        if not a["pq"]:
            self.ann_bar_refresh()
        if not a["pq"] and a["deferred"]:
            self.set_status(u"For previews open a 2D view (plan, section, sheet) and click \"Refresh\".")

    def do_ann_poll(self, uiapp):
        """We watch the selection in Revit: a selected annotation -> a save badge."""
        uidoc = uiapp.ActiveUIDocument
        a = self.ann
        if uidoc is None:
            return
        ids = list(uidoc.Selection.GetElementIds())
        sig = tuple(sorted(id_value(i) for i in ids))
        if sig == a["sel_sig"]:
            return
        a["sel_sig"] = sig
        doc = uidoc.Document
        found = []
        ann_ids = []
        for eid in ids[:100]:
            el = doc.GetElement(eid)
            if el is None:
                continue
            sym = ann_symbol_of(doc, el, True)
            if sym is not None:
                key = ann_key(sym)
                if key not in found:
                    found.append(key)
                ann_ids.append(eid)
            else:
                cat = getattr(el, "Category", None)
                if cat is not None:
                    cid = id_value(cat.Id)
                    if (cat.CategoryType == AnnCategoryType.Annotation or
                        cid == int(BuiltInCategory.OST_DetailComponents) or
                        isinstance(el, (Dimension, TextNote, IndependentTag))):
                        ann_ids.append(eid)
        a["sel"] = found
        a["sel_ids"] = ann_ids
        self.ann_update_banner()

    def ann_update_banner(self):
        keys = self.ann.get("sel", [])
        sel_ids = self.ann.get("sel_ids", [])
        total_items = len(sel_ids)
        if total_items == 0 and not keys:
            self.cardAnnSel.Visibility = Visibility.Collapsed
            self.cardAnnCreateGroup.Visibility = Visibility.Collapsed
            self.ann_bar_sync_add(False)
            return

        cfg = self.ann_cfg()
        favs = set(cfg["favs"])
        target = self.ann_target_set()
        tkeys = self.ann_set_get(target)["keys"] if target else []
        new = [k for k in keys if k not in favs or (target and k not in tkeys)]
        self.ann_bar_sync_add(bool(new))

        names = u", ".join(ann_split_key(k)[1] for k in keys[:2]) + (u" …" if len(keys) > 2 else u"")
        if total_items > 0:
            self.tbAnnSelText.Text = u"Selected in Revit: {} el. ({})".format(total_items, names if names else u"annotations")
        else:
            self.tbAnnSelText.Text = u"Selected in Revit: " + names

        self.cardAnnSel.Visibility = Visibility.Visible
        # The save-group button is always visible when there are selected elements
        self.btnAnnSaveGroupSel.Visibility = Visibility.Visible
        self.btnAnnSaveGroupSel.ToolTip = u"Save these {} annotations as a single group (node template) for quick insertion".format(total_items)

        # Button: add types to favorites
        sets = cfg.get("sets", [])
        if target:
            self.btnAnnSelAdd.Content = u"+ To set \"{}\"".format(target)
        elif sets:
            self.btnAnnSelAdd.Content = u"\u2605 To favorites / set\u2026"
        else:
            self.btnAnnSelAdd.Content = u"\u2605 To favorites"
        self.btnAnnSelAdd.Visibility = Visibility.Visible if new else Visibility.Collapsed

    def on_ann_save_group_click(self):
        """The user clicked 'Save as group' -> switch to the 'Annotation groups' tab."""
        self.ann["filter"] = ANN_GROUPS
        self.ann_render()

    def on_ann_new_group_key(self, e):
        if e.Key == System.Windows.Input.Key.Enter:
            e.Handled = True
            self.on_ann_do_save_group()
        elif e.Key == System.Windows.Input.Key.Escape:
            e.Handled = True
            self.cardAnnCreateGroup.Visibility = Visibility.Collapsed

    def on_ann_do_save_group(self):
        name = (self.tbAnnNewGroupName.Text or u"").strip()
        if not name:
            name = u"Annotation group"
        self.cardAnnCreateGroup.Visibility = Visibility.Collapsed
        self.run(lambda uiapp, n=name: self.do_create_ann_group(uiapp, n), "create_ann_group")

    def do_create_ann_group(self, uiapp, name):
        uidoc = uiapp.ActiveUIDocument
        if uidoc is None:
            return
        doc = uidoc.Document
        ids = self.ann.get("sel_ids", [])
        if not ids:
            self.set_status(u"No annotations selected to save a group.")
            return
        from System.Collections.Generic import List
        el_list = List[ElementId]()
        for i in ids:
            el_list.Add(i)

        t = Transaction(doc, u"Save annotation group")
        t.Start()
        try:
            grp = doc.Create.NewGroup(el_list)
            gt = grp.GroupType
            base_name = name
            final_name = base_name
            idx = 2
            while True:
                try:
                    gt.Name = final_name
                    break
                except Exception:
                    final_name = u"{} ({})".format(base_name, idx)
                    idx += 1
                    if idx > 100:
                        break
            t.Commit()
            self.set_status(u"Group \"{}\" saved successfully ({} elements)!".format(final_name, len(ids)))
            self.ann["filter"] = u"group:" + unicode(id_value(gt.Id))
            self.ann_load_groups(doc)
        except Exception as ex:
            t.RollBack()
            self.set_status(u"Could not create the Revit group: {}".format(ex))

    def ann_load_groups(self, doc):
        """Loads all Detail Groups from the Revit project."""
        if doc is None:
            self.ann["groups"] = []
            return
        groups = []
        try:
            col = FilteredElementCollector(doc).OfClass(DB.GroupType)
            for gt in col:
                try:
                    cat = gt.Category
                    if cat is not None and id_value(cat.Id) == int(BuiltInCategory.OST_IOSDetailGroups):
                        groups.append({
                            "id": id_value(gt.Id),
                            "name": gt.Name,
                            "eid": gt.Id
                        })
                except Exception:
                    pass
        except Exception as ex:
            tk_log(u"ann_load_groups: {}".format(ex))
        self.ann["groups"] = sorted(groups, key=lambda g: nat(g["name"]))
        self.ann_render()

    def ann_place_group(self, group_id, ungroup=False):
        """Start of group insertion: we ask Revit to enter the point-pick mode."""
        self.set_status(u"Click in the Revit view to insert the group (Esc — cancel)...")
        self.ann_focus_revit()
        self.run(lambda uiapp, gid=group_id, ug=ungroup: self.do_place_group(uiapp, gid, ug), "place_group")

    def do_place_group(self, uiapp, group_id, ungroup):
        uidoc = uiapp.ActiveUIDocument
        if uidoc is None:
            return
        doc = uidoc.Document
        if ann_bad_view(doc.ActiveView):
            self.set_status(u"Open a 2D view or sheet to insert annotations.")
            return
        gt = doc.GetElement(revit_id(group_id))
        if gt is None or not isinstance(gt, DB.GroupType):
            self.set_status(u"The group was not found in the project.")
            return
        try:
            pt = uidoc.Selection.PickPoint(u"Pick a point to insert the group \"{}\"".format(gt.Name))
        except OperationCanceledException:
            self.set_status(u"Insertion cancelled.")
            return
        except Exception as ex:
            self.set_status(u"Cancelled or point pick error: {}".format(ex))
            return

        t = Transaction(doc, u"Insert annotation group")
        t.Start()
        try:
            grp = doc.Create.PlaceGroup(pt, gt)
            if ungroup:
                grp.Ungroup()
                msg = u"Group \"{}\" inserted and ungrouped!".format(gt.Name)
            else:
                msg = u"Group \"{}\" inserted successfully!".format(gt.Name)
            t.Commit()
            self.set_status(msg)
        except Exception as ex:
            t.RollBack()
            self.set_status(u"Could not insert the group: {}".format(ex))

    def ann_sel_add_clicked(self):
        """"To favorites / set…" was clicked: if there are sets and none is active - we show a small pick dialog."""
        cfg = self.ann_cfg()
        sets = cfg.get("sets", [])
        target = self.ann_target_set()
        if target or not sets:
            # an active set or no sets at all — we just save
            self.run(self.do_ann_from_sel, "annsel")
            return
        # there are sets but none is active — we show the pick popup
        self.ann_pick_set_dialog()

    def ann_pick_set_dialog(self):
        """A small popup: "Favorites only" + the list of sets."""
        cfg = self.ann_cfg()
        sets = cfg.get("sets", [])
        # we build the WPF window right in code
        from System.Windows import Window, WindowStartupLocation
        from System.Windows.Controls import StackPanel, Button, Label
        dlg = Window()
        dlg.Title = u"Save to…"
        dlg.WindowStyle = getattr(System.Windows.WindowStyle, "None")
        dlg.AllowsTransparency = True
        dlg.Background = System.Windows.Media.Brushes.Transparent
        dlg.SizeToContent = System.Windows.SizeToContent.WidthAndHeight
        dlg.WindowStartupLocation = WindowStartupLocation.CenterOwner
        dlg.ShowInTaskbar = False
        dlg.MinWidth = 240
        try:
            from System.Windows.Interop import WindowInteropHelper
            WindowInteropHelper(dlg).Owner = self.win
        except Exception:
            pass

        from System.Windows.Media.Effects import DropShadowEffect
        from System.Windows import CornerRadius, Thickness
        outer = Border()
        outer.Margin = Thickness(12)
        outer.CornerRadius = CornerRadius(12)
        outer.Background = isl_brush("#1C1C1E")
        outer.BorderBrush = isl_brush("#3A3A3C")
        outer.BorderThickness = Thickness(1)
        outer.Effect = DropShadowEffect(BlurRadius=20, ShadowDepth=4, Opacity=0.5)
        sp = StackPanel()
        sp.Margin = Thickness(12, 10, 12, 10)
        outer.Child = sp
        dlg.Content = outer

        hdr = TextBlock()
        hdr.Text = u"Save {} annotations to:".format(len(self.ann["sel"]))
        hdr.Foreground = isl_brush("#8E8E93")
        hdr.FontSize = 11
        hdr.Margin = Thickness(0, 0, 0, 8)
        sp.Children.Add(hdr)

        chosen = [None]  # [set_name or "fav" or None=cancel]

        def make_btn(text, value, is_primary=False):
            # pill as on the "Modules" tab: lime (primary) / neutral; the dialog has a darker background #1C1C1E,
            # so the neutral one here is #2C2C2E
            bg, hv, fgc = ((u"#0071E3", u"#2997FF", u"#FFFFFF") if is_primary
                           else (u"#2C2C2E", u"#3A3A3C", u"#F5F5F7"))
            b = Border()
            b.CornerRadius = CornerRadius(17)
            b.Height = 34
            b.Margin = Thickness(0, 0, 0, 6)
            b.Padding = Thickness(14, 0, 14, 0)
            b.Cursor = AnnCursors.Hand
            b.Background = isl_brush(bg)
            t = TextBlock()
            t.Text = text
            t.FontSize = 13
            t.FontWeight = FontWeights.SemiBold
            t.Foreground = isl_brush(fgc)
            t.VerticalAlignment = VerticalAlignment.Center
            t.HorizontalAlignment = System.Windows.HorizontalAlignment.Center
            b.Child = t
            b.MouseEnter += lambda s, e: setattr(b, "Background", isl_brush(hv))
            b.MouseLeave += lambda s, e: setattr(b, "Background", isl_brush(bg))
            def clicked(s, e, v=value):
                chosen[0] = v
                dlg.Close()
            b.MouseLeftButtonUp += clicked
            return b

        # button "Favorites only"
        sp.Children.Add(make_btn(u"\u2605  Favorites only", "fav"))

        # separator
        sep = Border()
        sep.Height = 1
        sep.Background = isl_brush("#3A3A3C")
        sep.Margin = Thickness(0, 4, 0, 8)
        sp.Children.Add(sep)

        lbl = TextBlock()
        lbl.Text = u"OR TO A SET:"
        lbl.Foreground = isl_brush("#636366")
        lbl.FontSize = 10
        lbl.FontWeight = FontWeights.SemiBold
        lbl.Margin = Thickness(0, 0, 0, 6)
        sp.Children.Add(lbl)

        for st in sets:
            sp.Children.Add(make_btn(u"\u2630  " + st["name"], st["name"], True))

        # cancel button
        canc = Border()
        canc.Height = 1
        canc.Background = isl_brush("#3A3A3C")
        canc.Margin = Thickness(0, 4, 0, 4)
        sp.Children.Add(canc)
        sp.Children.Add(make_btn(u"Cancel", None))

        dlg.ShowDialog()

        val = chosen[0]
        if val is None:
            return  # cancel
        if val == "fav":
            self.run(lambda ua: self.do_ann_from_sel(ua, force_set=None), "annsel")
        else:
            self.run(lambda ua, s=val: self.do_ann_from_sel(ua, force_set=s), "annsel")

    def do_ann_from_sel(self, uiapp, force_set=None):
        """force_set: the set name if chosen from the dialog; None — determine automatically."""
        uidoc = uiapp.ActiveUIDocument
        doc = uidoc.Document
        cfg = self.ann_cfg()
        a = self.ann
        view = doc.ActiveView
        added, known, skipped, picked = [], 0, 0, []
        for eid in uidoc.Selection.GetElementIds():
            el = doc.GetElement(eid)
            sym = ann_symbol_of(doc, el, False)
            if sym is None:
                skipped += 1
                continue
            key = ann_key(sym)
            if key in cfg["favs"] or key in added:
                known += 1
            else:
                added.append(key)
            if key not in picked:
                picked.append(key)
            # the preview is taken from the real instance the user selected in the view
            if not a["img"].get(key):
                img = ann_preview(sym)
                if img is None and isinstance(el, FamilyInstance) and not ann_bad_view(view):
                    img = ann_draw_preview(ann_geom_polylines(el, view))
                if img is not None:
                    a["img"][key] = img
        if not added and not known:
            self.set_status(u"The selection has no annotation types. Select an annotation in a view and try again.")
            return
        cfg["favs"].extend(added)
        # we determine the set: forced > active > none
        target = force_set if force_set is not None else self.ann_target_set()
        in_set = 0
        if target:
            st = self.ann_set_get(target)
            if st is not None:
                for k in picked:
                    if k not in st["keys"]:
                        st["keys"].append(k)
                        in_set += 1
        self.ann_save()
        names = u", ".join(ann_split_key(k)[1] for k in added[:3])
        bits = []
        if added:
            bits.append(u"Added to favorites: {} ({})".format(len(added), names + (u"…" if len(added) > 3 else u"")))
        if known:
            bits.append(u"were already there: {}".format(known))
        if in_set:
            bits.append(u"to set \u00AB{}\u00BB: {}".format(target, in_set))
        if skipped:
            bits.append(u"skipped (not family types): {}".format(skipped))
        self.do_ann_load(uiapp)
        a["sel_sig"] = None
        self.do_ann_poll(uiapp)
        self.set_status(u"  \u00B7  ".join(bits))

    # ---------- placement: the annotation appears on the cursor ----------
    def ann_place(self, key):
        it = self.ann["by"].get(key)
        if it is None:
            return
        if not it["present"]:
            self.set_status(u"\"{}\" is not in this project: load the family \"{}\".".format(it["typ"], it["fam"]))
            return
        b = getattr(self, "bar", None)
        try:
            if b and b.get("win") is not None and self.ann_use_wasd(key):
                self.ann_side_arm(key)
                return
            if b and b.get("win") is not None and b.get("side_key"):
                self.ann_side_disarm()            # standard placement: we disarm WASD
        except Exception as ex:
            tk_log(u"ann_place mode: {}".format(ex))
            self.set_status(u"WASD mode error ({}) - placing normally.".format(ex))
        self.set_status(u"\"{}\": go to a view and click to place. Esc or right-click — finish.".format(it["typ"]))
        self.ann_bar_set_active(key)
        self.ann_focus_revit()
        self.run(lambda uiapp, k=key: self.do_ann_place_tracked(uiapp, k), "annplace")

    def ann_focus_revit(self):
        """A click on the panel gave it the keyboard focus - we return it to Revit, otherwise the first Esc is lost."""
        try:
            import ctypes
            ctypes.windll.user32.SetForegroundWindow(ctypes.c_void_p(uiapp.MainWindowHandle.ToInt64()))
        except Exception as ex:
            tk_log(u"ann focus revit: {}".format(ex))

    def ann_bar_key(self, e):
        """Esc when the focus is still on the panel: hand it to Revit and send Esc to finish the placement."""
        if e.Key != Key.Escape:
            return
        e.Handled = True
        if not self.bar.get("active"):
            return
        try:
            import ctypes
            self.ann_focus_revit()
            ctypes.windll.user32.keybd_event(0x1B, 0, 0, 0)    # Esc down
            ctypes.windll.user32.keybd_event(0x1B, 0, 2, 0)    # Esc up
        except Exception as ex:
            tk_log(u"ann esc: {}".format(ex))

    def do_ann_place_tracked(self, uiapp, key):
        try:
            self.do_ann_place(uiapp, key)
        finally:
            self.ann_bar_set_active(None)
            self.recent_add("anns", key)      # writing settings.json - after the placement

    def do_ann_place(self, uiapp, key):
        uidoc = uiapp.ActiveUIDocument
        doc = uidoc.Document
        it = self.ann["by"].get(key)
        if it is None:
            return
        if ann_bad_view(doc.ActiveView):
            self.set_status(u"Open a 2D view or sheet: annotations are not placed in 3D and schedules.")
            return
        sym = doc.GetElement(it["eid"]) if it["eid"] is not None else None
        if sym is None:
            sym = ann_find_symbol(doc, key)
            if sym is None:
                self.set_status(u"Type \"{}\" was not found in the model.".format(it["typ"]))
                return
            it["eid"] = sym.Id
        if not sym.IsActive:
            t = Transaction(doc, u"Activate annotation type")
            t.Start()
            try:
                sym.Activate()
                doc.Regenerate()
                t.Commit()
            except Exception:
                t.RollBack()
                raise
        try:
            uidoc.PromptForFamilyInstancePlacement(sym)
            self.set_status(u"Placement finished.")
        except OperationCanceledException:
            self.set_status(u"Placement finished.")
        except Exception as ex:
            self.set_status(u"This type cannot be placed this way (tags are placed via Annotate \u2192 Tag): {}".format(ex))

    # ---------- "To geometry" mode ----------
    def ann_side_gap_mm(self):
        try:
            v = float(self.settings.get("ann_side_gap_mm", ANN_SIDE_GAP_MM))
        except Exception:
            v = ANN_SIDE_GAP_MM
        return max(ANN_SIDE_GAP_MIN, min(ANN_SIDE_GAP_MAX, v))

    def ann_side_gap_set(self, mm):
        mm = round(max(ANN_SIDE_GAP_MIN, min(ANN_SIDE_GAP_MAX, float(mm))), 1)
        if mm != self.settings.get("ann_side_gap_mm"):
            self.settings["ann_side_gap_mm"] = mm
            try:
                save_settings(self.settings)
            except Exception as ex:
                tk_log(u"ann gap save: {}".format(ex))
        self.ann_bar_gap_text()
        return mm

    def ann_bar_gap_text(self):
        b = getattr(self, "bar", None)
        if b and b.get("tbGap") is not None:
            b["tbGap"].Text = u"{:g}".format(self.ann_side_gap_mm())

    def ann_side_gap_step(self, sign):
        try:
            from System.Windows.Input import Keyboard as _Kb, ModifierKeys as _Mk
            big = (int(_Kb.Modifiers) & int(_Mk.Shift)) != 0
        except Exception:
            big = False
        self.ann_side_gap_set(self.ann_side_gap_mm() + sign * (5.0 if big else 1.0))

    def ann_side_gap_wheel(self, s, e):
        e.Handled = True
        self.ann_side_gap_step(1 if e.Delta > 0 else -1)

    def ann_side_gap_commit(self, back_to_revit=True):
        b = getattr(self, "bar", None)
        if not b or b.get("tbGap") is None:
            return
        try:
            v = float(b["tbGap"].Text.replace(u",", u".").strip())
        except Exception:
            v = self.ann_side_gap_mm()
        self.ann_side_gap_set(v)
        if back_to_revit:
            self.ann_focus_revit()

    def ann_side_gap_key(self, s, e):
        if e.Key == Key.Enter or e.Key == Key.Return:
            e.Handled = True
            self.ann_side_gap_commit(True)

    def ann_bar_side_paint(self):
        b = getattr(self, "bar", None)
        if not b or b.get("win") is None or b.get("btnSide") is None:
            return
        pal = self.ann_bar_pal()
        on = bool(b.get("side"))
        caps = ann_caps_on()
        b["caps"] = caps
        ready = (not ANN_SIDE_NEED_CAPS) or caps
        b["btnSide"].Background = ann_brush(pal["seg_sel_bg"] if on else pal["pill"])
        fg = ann_brush(pal["seg_sel_t"] if on else pal["pill_t"])
        b["icSide"].Foreground = fg
        b["icSide"].Opacity = 1.0 if (not on or ready) else 0.55      # WASD is allowed, but Caps Lock is off -> standard for now
        if on:
            b["btnSide"].ToolTip = (
                u"WASD is on. Annotations marked WASD: Caps Lock on - to geometry (W/A/S/D), off - standard. "
                u"The rest - always standard (right-click an annotation - change). Caps Lock now: "
                + (u"ON" if caps else u"off") + u".  Click - turn WASD off completely")
        else:
            b["btnSide"].ToolTip = u"WASD is off - all annotations are placed normally. Click - turn on (works for annotations marked WASD)"
        # the offset field is visible only in the "To geometry" mode
        b["gapPnl"].Visibility = Visibility.Visible if on else Visibility.Collapsed
        b["gapPnl"].Background = ann_brush(pal["pill"])
        b["icGap"].Foreground = ann_brush(pal["hint"])
        b["lbGapMm"].Foreground = ann_brush(pal["hint"])
        b["icGapDn"].Foreground = ann_brush(pal["icon"])
        b["icGapUp"].Foreground = ann_brush(pal["icon"])
        b["btnGapDn"].Background = ann_brush(pal["ghost"])
        b["btnGapUp"].Background = ann_brush(pal["ghost"])
        b["tbGap"].Foreground = ann_brush(pal["pill_t"])
        b["tbGap"].CaretBrush = ann_brush(pal["pill_t"])
        if not b["tbGap"].IsKeyboardFocused:
            self.ann_bar_gap_text()

    def ann_bar_toggle_side(self):
        b = self.bar
        if b.get("win") is None:
            return
        b["side"] = not b.get("side")
        caps_hint = u" Turn on Caps Lock." if (ANN_SIDE_NEED_CAPS and not ann_caps_on()) else u""
        if b["side"]:
            self.ann_side_disarm()
            self.set_status(u"WASD is on for marked annotations (right-click an annotation): pick it, select geometry, "
                            u"press W / A / S / D. Without Caps Lock - standard placement. Esc - reset the choice." + caps_hint)
        else:
            self.ann_side_disarm()
            self.ann_side_hook_off()
            self.set_status(u"WASD is off: all annotations are placed with the cursor.")
        self.ann_bar_side_paint()

    def ann_use_wasd(self, key):
        """WASD for this annotation: mode on + annotation marked + (Caps Lock on, if needed).
        Otherwise - standard placement with the cursor."""
        b = getattr(self, "bar", None)
        if not b or not b.get("side"):
            return False
        if key not in self.ann_cfg()["wasd"]:
            return False
        return (not ANN_SIDE_NEED_CAPS) or ann_caps_on()

    def ann_wasd_toggle(self, key):
        """Toggle for the annotation type: WASD <-> always standard."""
        cfg = self.ann_cfg()
        name = ann_split_key(key)[1]
        if key in cfg["wasd"]:
            cfg["wasd"].remove(key)
            if self.bar.get("side_key") == key:
                self.ann_side_disarm()
            msg = u"\"{}\": always standard placement.".format(name)
        else:
            cfg["wasd"].append(key)
            msg = u"\"{}\": WASD mode (with Caps Lock on; without it - standard).".format(name)
        self.ann_save()
        if self.bar.get("win") is not None:
            self.ann_bar_refresh()
        try:
            self.ann_render()
            if self.ann.get("edit") == key:
                self.ann_edit_open(key)
        except Exception as ex:
            tk_log(u"ann wasd refresh: {}".format(ex))
        self.set_status(msg)

    def ann_side_armed(self):
        b = getattr(self, "bar", None)
        return bool(b and b.get("win") is not None and b.get("side") and b.get("side_key"))

    def ann_side_hook_on(self):
        b = self.bar
        if b.get("hook") is None:
            try:
                hwnd = int(uiapp.MainWindowHandle.ToInt64())
            except Exception:
                hwnd = 0
            b["hook"] = AnnKeyHook(hwnd, self.ann_side_armed, self.ann_side_on_key, self.ann_side_on_esc)
        return b["hook"].install()

    def ann_side_hook_off(self):
        b = getattr(self, "bar", None)
        if b and b.get("hook") is not None:
            b["hook"].uninstall()
            b["hook"] = None

    def ann_side_arm(self, key):
        b = self.bar
        it = self.ann["by"].get(key)
        if b.get("side_key") == key:          # a repeated click on the same annotation - reset
            self.ann_side_disarm()
            self.set_status(u"Annotation choice reset.")
            return
        if not self.ann_side_hook_on():
            self.set_status(u"Could not turn on the W/A/S/D key interception.")
            return
        b["side_key"] = key
        self.recent_add("anns", key)
        self.ann_bar_set_active(key)
        self.set_status(u"\"{}\": select geometry in the view and press W / A / S / D{}.".format(
            it["typ"] if it else key,
            u" (Caps Lock must be on)" if (ANN_SIDE_NEED_CAPS and not ann_caps_on()) else u""))
        self.ann_focus_revit()

    def ann_side_disarm(self):
        b = getattr(self, "bar", None)
        if not b:
            return
        b["side_key"] = None
        if b.get("win") is not None:
            self.ann_bar_set_active(None)

    def ann_side_on_esc(self):
        # Esc will also reach Revit (it clears the selection); here we only disarm
        self.ann_side_disarm()
        self.set_status(u"Annotation choice reset.")

    def ann_side_on_key(self, side):
        key = self.bar.get("side_key")
        if key:
            self.run(lambda uiapp, k=key, sd=side: self.do_ann_side(uiapp, k, sd), "annside")

    def do_ann_side(self, uiapp, key, side):
        """Revit context: place the annotation key next to the side of the selected geometry."""
        b = self.bar
        uidoc = uiapp.ActiveUIDocument
        doc = uidoc.Document
        view = doc.ActiveView
        if ann_bad_view(view):
            self.set_status(u"Open a 2D view or sheet: annotations are not placed in 3D and schedules.")
            return
        it = self.ann["by"].get(key)
        if it is None:
            return
        sym = doc.GetElement(it["eid"]) if it["eid"] is not None else None
        if sym is None:
            sym = ann_find_symbol(doc, key)
            if sym is None:
                self.set_status(u"Type \"{}\" was not found in the model.".format(it["typ"]))
                return
            it["eid"] = sym.Id
        mine = set()
        for v in b["side_last"].values():
            mine.add(v)
        ids = [i for i in uidoc.Selection.GetElementIds() if id_value(i) not in mine]
        els = [doc.GetElement(i) for i in ids]
        els = [e for e in els if e is not None]
        if not els:
            self.set_status(u"First select geometry in the view, then press W / A / S / D.")
            return
        ext = ann_side_extent(view, els)
        if ext is None:
            self.set_status(u"The selected elements have no bounds in this view.")
            return
        sig = (key, tuple(sorted(id_value(i) for i in ids)), side)
        t = Transaction(doc, u"Annotation to side")
        t.Start()
        try:
            if not sym.IsActive:
                sym.Activate()
                doc.Regenerate()
            old = b["side_last"].get(sig)          # that place was already taken - we reposition instead of duplicating
            if old is not None:
                try:
                    doc.Delete(revit_id(old))
                except Exception:
                    pass
            gap_mm = self.ann_side_gap_mm()
            ckey = (key, id_value(view.Id), 1 if isinstance(view, ViewSheet) else view.Scale)
            inst = ann_side_place(doc, view, sym, ext, side, ann_side_gap_ft(view, gap_mm),
                                  cache=b.setdefault("ext_cache", {}), ckey=ckey)
            t.Commit()
            b["side_last"][sig] = id_value(inst.Id)
            self.set_status(u"\"{}\" stands {} from the geometry ({} mm). You can press another side.".format(
                it["typ"], ANN_SIDE_NAMES[side], u"{:g}".format(gap_mm)))
        except Exception as ex:
            try:
                t.RollBack()
            except Exception:
                pass
            tk_log(u"ann side place: {}".format(ex))
            self.set_status(u"Could not place \"{}\": {}".format(it["typ"], ex))

    # ---------- group placement (set) ----------
    def ann_place_set(self, set_name):
        """Start sequential placement of all annotations of a set — one after another."""
        st = self.ann_set_get(set_name)
        if st is None:
            return
        keys = [k for k in st["keys"] if k in self.ann["by"] and self.ann["by"][k]["present"]]
        if not keys:
            self.set_status(u"Set \"{}\" is empty or none of its annotations is in the project.".format(set_name))
            return
        names = [ann_split_key(k)[1] for k in keys]
        self.set_status(u"Set \"{}\": {} annotations will be placed one by one. Press Esc after each to go to the next one.".format(
            set_name, len(keys)))
        self.ann_focus_revit()
        self.run(lambda uiapp, ks=keys, sn=set_name: self.do_ann_place_set(uiapp, ks, sn), "annplaceset")

    def do_ann_place_set(self, uiapp, keys, set_name):
        """Revit context: we place each annotation of the set one by one."""
        uidoc = uiapp.ActiveUIDocument
        doc = uidoc.Document
        if ann_bad_view(doc.ActiveView):
            self.set_status(u"Open a 2D view or sheet: annotations are not placed in 3D and schedules.")
            return
        placed, skipped = 0, []
        for i, key in enumerate(keys):
            it = self.ann["by"].get(key)
            if it is None or not it["present"]:
                skipped.append(key)
                continue
            sym = doc.GetElement(it["eid"]) if it["eid"] is not None else None
            if sym is None:
                sym = ann_find_symbol(doc, key)
                if sym is None:
                    skipped.append(key)
                    continue
                it["eid"] = sym.Id
            # we activate the symbol if needed
            if not sym.IsActive:
                t = Transaction(doc, u"Activate annotation type")
                t.Start()
                try:
                    sym.Activate()
                    doc.Regenerate()
                    t.Commit()
                except Exception:
                    t.RollBack()
                    skipped.append(key)
                    continue
            typ_name = ann_split_key(key)[1]
            self.ann_bar_set_active(key)
            remaining = len(keys) - i - 1
            hint = u"({}/{}) \"{}\"  —  Esc to go to the next{}".format(
                i + 1, len(keys), typ_name,
                u"  ·  next: \"{}\"".format(ann_split_key(keys[i + 1])[1]) if remaining else u"  ·  last one!")
            self.ann_bar_hint(hint)
            try:
                uidoc.PromptForFamilyInstancePlacement(sym)
                placed += 1
            except OperationCanceledException:
                placed += 1   # Esc — normal completion of one type
            except Exception as ex:
                skipped.append(key)
                tk_log(u"place_set {}: {}".format(key, ex))
        self.ann_bar_set_active(None)
        bits = [u"Set \"{}\" placed".format(set_name)]
        if placed:
            bits.append(u"done: {}".format(placed))
        if skipped:
            bits.append(u"skipped: {}".format(len(skipped)))
        self.set_status(u"  \u00B7  ".join(bits))

    # ---------- favorites / editor ----------
    def ann_toggle_fav(self, key):
        cfg = self.ann_cfg()
        if key in cfg["favs"]:
            cfg["favs"].remove(key)
            for st in cfg["sets"]:
                if key in st["keys"]:
                    st["keys"].remove(key)
            it = self.ann["by"].get(key)
            if it is not None and not it["insrc"]:
                self.ann["items"].remove(it)
                del self.ann["by"][key]
        else:
            cfg["favs"].append(key)
        self.ann_save()
        self.ann_render()
        if self.ann["edit"] == key:
            self.ann_edit_open(key)

    # ---------- sets ----------
    def ann_set_get(self, name):
        for st in self.ann_cfg()["sets"]:
            if st["name"] == name:
                return st
        return None

    def ann_target_set(self):
        """The set we are "filling" now: the active panel tab or the set chosen in the list."""
        b = getattr(self, "bar", None)
        if b and b["win"] is not None and self.ann_set_get(b["filter"]) is not None:
            return b["filter"]
        f = self.ann["filter"]
        if f.startswith(u"set:") and self.ann_set_get(f[4:]) is not None:
            return f[4:]
        return None

    def ann_set_panel_sync(self):
        a = self.ann
        f = a["filter"]
        st = self.ann_set_get(f[4:]) if f.startswith(u"set:") else None
        if a["setmode"] == "new":
            self.cardAnnSet.Visibility = Visibility.Visible
            self.tbAnnSetTitle.Text = u"NEW SET"
            self.btnAnnSetDelete.Visibility = Visibility.Collapsed
        elif st is not None:
            self.cardAnnSet.Visibility = Visibility.Visible
            self.tbAnnSetTitle.Text = u"SET: NAME"
            self.btnAnnSetDelete.Visibility = Visibility.Visible
            if not self.tbAnnSetName.IsKeyboardFocused and self.tbAnnSetName.Text != st["name"]:
                self.tbAnnSetName.Text = st["name"]
        else:
            self.cardAnnSet.Visibility = Visibility.Collapsed
        self.btnAnnSetDelete.Content = u"Really delete?" if a["setdel"] else u"Delete"

    def ann_set_new(self):
        self.ann["setmode"] = "new"
        self.ann["setdel"] = False
        self.tbAnnSetName.Text = u""
        self.ann_set_panel_sync()
        self.tbAnnSetName.Focus()

    def ann_set_key(self, e):
        if e.Key == System.Windows.Input.Key.Enter:
            e.Handled = True
            self.ann_set_save()

    def ann_set_save(self):
        a = self.ann
        cfg = self.ann_cfg()
        name = (self.tbAnnSetName.Text or u"").strip()
        if not name or name.startswith(u"__") or name.startswith(u"set:"):
            self.set_status(u"Enter a set name.")
            return
        cur = None
        if a["setmode"] != "new" and a["filter"].startswith(u"set:"):
            cur = self.ann_set_get(a["filter"][4:])
        for st in cfg["sets"]:
            if st is not cur and st["name"].lower() == name.lower():
                self.set_status(u"A set with this name already exists.")
                return
        if cur is None:
            cfg["sets"].append({"name": name, "keys": []})
            a["setmode"] = None
        else:
            old = cur["name"]
            cur["name"] = name
            b = self.bar
            if b["filter"] == old:
                b["filter"] = name
        a["filter"] = u"set:" + name
        a["setdel"] = False
        self.ann_save()
        self.ann_render()
        self.set_status(u"Set \u00AB{}\u00BB saved. Mark annotations via \u270E.".format(name))

    def ann_set_delete(self):
        a = self.ann
        cfg = self.ann_cfg()
        if not a["setdel"]:
            a["setdel"] = True
            self.btnAnnSetDelete.Content = u"Really delete?"
            return
        st = self.ann_set_get(a["filter"][4:]) if a["filter"].startswith(u"set:") else None
        if st is not None:
            cfg["sets"].remove(st)
            if self.bar["filter"] == st["name"]:
                self.bar["filter"] = ANN_FAV
        a["filter"] = ANN_FAV
        a["setdel"] = False
        self.ann_save()
        self.ann_render()

    def ann_set_toggle(self, name, key):
        cfg = self.ann_cfg()
        st = self.ann_set_get(name)
        if st is None:
            return
        if key in st["keys"]:
            st["keys"].remove(key)
        else:
            st["keys"].append(key)
            if key not in cfg["favs"]:
                cfg["favs"].append(key)
        self.ann_save()
        self.ann_render()
        self.ann_edit_open(key)

    def ann_set_chip(self, name, on, key):
        bd = Border()
        bd.CornerRadius = CornerRadius(12)
        bd.Padding = Thickness(11, 4, 11, 4)
        bd.Margin = Thickness(0, 0, 6, 6)
        bd.Cursor = AnnCursors.Hand
        bd.Background = isl_brush("#1F0A84FF" if on else "#14FFFFFF")
        tb = TextBlock()
        tb.Text = (u"\u2713  " if on else u"") + name
        tb.FontWeight = FontWeights.SemiBold if on else FontWeights.Medium
        tb.Foreground = isl_brush("#0A84FF" if on else "#A1A1A6")
        bd.Child = tb
        bd.MouseLeftButtonUp += lambda s, e, n=name, k=key: self.ann_set_toggle(n, k)
        return bd

    def ann_user_cats(self):
        cats = set(c for c in self.ann_cfg()["cats"].values() if c)
        return sorted(cats, key=lambda c: nat(c))

    def ann_edit_open(self, key):
        a = self.ann
        it = a["by"].get(key)
        if it is None:
            return
        cfg = self.ann_cfg()
        a["edit"] = key
        self.tbAnnEditName.Text = it["typ"]
        self.tbAnnEditFam.Text = u"{}  \u00B7  {}".format(it["fam"], it["rcat"] or u"not in the project")
        self.tbAnnNote.Text = cfg["notes"].get(key, u"")
        self.cbAnnCat.Items.Clear()
        for c in self.ann_user_cats():
            self.cbAnnCat.Items.Add(c)
        self.cbAnnCat.Text = cfg["cats"].get(key, u"")
        self.btnAnnEditFav.Content = u"\u2605 In favorites" if key in cfg["favs"] else u"\u2606 To favorites"
        self.btnAnnEditWasd.Content = u"WASD: yes" if key in cfg["wasd"] else u"WASD: no"
        self.pnlAnnEditSets.Children.Clear()
        if cfg["sets"]:
            for st in cfg["sets"]:
                self.pnlAnnEditSets.Children.Add(self.ann_set_chip(st["name"], key in st["keys"], key))
        else:
            hint = TextBlock()
            hint.Text = u"No sets yet: create one in the left column (\u00ABNew set\u00BB)."
            hint.Foreground = isl_brush("#8E8E93")
            hint.FontSize = 12
            self.pnlAnnEditSets.Children.Add(hint)
        self.cardAnnEdit.Visibility = Visibility.Visible

    def ann_edit_close(self):
        self.ann["edit"] = None
        self.cardAnnEdit.Visibility = Visibility.Collapsed

    def ann_edit_fav(self):
        if self.ann["edit"]:
            self.ann_toggle_fav(self.ann["edit"])

    def ann_edit_save(self):
        key = self.ann["edit"]
        if not key:
            return
        cfg = self.ann_cfg()
        note = (self.tbAnnNote.Text or u"").strip()
        cat = (self.cbAnnCat.Text or u"").strip()
        if note:
            cfg["notes"][key] = note
        else:
            cfg["notes"].pop(key, None)
        if cat:
            cfg["cats"][key] = cat
        else:
            cfg["cats"].pop(key, None)
        self.ann_save()
        self.ann_render()
        self.ann_edit_open(key)
        self.set_status(u"Saved: " + ann_split_key(key)[1])

    # ---------- group selection of tiles in Toolkit ----------
    def ann_msel_toggle(self, key):
        """Ctrl+click on a tile — adds/removes the key to/from the group selection."""
        msel = self.ann["msel"]
        if key in msel:
            msel.discard(key)
        else:
            msel.add(key)
        self.ann_msel_banner()
        self.ann_render()

    def ann_msel_clear(self):
        """Reset the group selection."""
        self.ann["msel"].clear()
        self.ann_msel_banner()
        self.ann_render()

    def ann_msel_banner(self):
        """Refresh the group selection badge."""
        msel = self.ann["msel"]
        try:
            card = self.cardAnnMultiSel
            tb   = self.tbAnnMSelText
            btn_set = self.btnAnnMSelSet
        except Exception:
            return
        if not msel:
            card.Visibility = Visibility.Collapsed
            return
        names = u", ".join(ann_split_key(k)[1] for k in list(msel)[:3])
        if len(msel) > 3:
            names += u" …"
        tb.Text = u"Selected in Toolkit: {} ({})".format(len(msel), names)
        # the "To set" button only if there is an active set
        target = self.ann_target_set()
        btn_set.Visibility = Visibility.Visible if target else Visibility.Collapsed
        if target:
            btn_set.ToolTip = u"Add {} selected to the set \"{}\"".format(len(msel), target)
        card.Visibility = Visibility.Visible

    def ann_msel_save_favs(self):
        """Add all selected tiles to favorites."""
        msel = self.ann["msel"]
        if not msel:
            return
        cfg = self.ann_cfg()
        added = []
        for key in list(msel):
            if key not in cfg["favs"]:
                cfg["favs"].append(key)
                added.append(key)
        self.ann_save()
        self.ann["msel"].clear()
        self.ann_render()
        if added:
            self.set_status(u"Added to favorites: {} annotations.".format(len(added)))
        else:
            self.set_status(u"All the selected ones were already in favorites.")

    def ann_msel_save_set(self):
        """Add all selected tiles to the active set (and to favorites)."""
        msel = self.ann["msel"]
        if not msel:
            return
        target = self.ann_target_set()
        if not target:
            self.set_status(u"No active set. Go to a set tab in the panel or the list on the left.")
            return
        cfg = self.ann_cfg()
        st = self.ann_set_get(target)
        if st is None:
            return
        added_fav, added_set = [], []
        for key in list(msel):
            if key not in cfg["favs"]:
                cfg["favs"].append(key)
                added_fav.append(key)
            if key not in st["keys"]:
                st["keys"].append(key)
                added_set.append(key)
        self.ann_save()
        self.ann["msel"].clear()
        self.ann_render()
        bits = []
        if added_set:
            bits.append(u"To set \"{}\": {}".format(target, len(added_set)))
        if added_fav:
            bits.append(u"to favorites: {}".format(len(added_fav)))
        already = len(msel) - len(added_set) if len(msel) >= len(added_set) else 0
        if already:
            bits.append(u"were already there: {}".format(already))
        self.set_status(u"  ·  ".join(bits) if bits else u"The selected ones are already in the set.")

    # ---------- building the interface ----------
    def ann_icon(self, glyph, tip, color, action):
        b = Border()
        b.Background = isl_brush("#01000000")
        b.Padding = Thickness(4, 2, 4, 2)
        b.Cursor = AnnCursors.Hand
        b.ToolTip = tip
        t = TextBlock()
        t.Text = glyph
        t.FontFamily = ICON_FONT
        t.FontSize = 14
        t.Foreground = ann_brush(color)
        b.Child = t

        def up(s, e):
            e.Handled = True
            action()
        b.MouseLeftButtonUp += up
        b.MouseLeftButtonDown += lambda s, e: setattr(e, "Handled", True)
        return b

    def ann_make_row(self, it, fav, note):
        """A dense row for the compact mode: thumbnail · name/family · ★ · ✎."""
        a = self.ann
        key = it["key"]
        present = it["present"]
        row = Border()
        row.Margin = Thickness(0, 0, 0, 1)
        row.Padding = Thickness(6, 4, 4, 4)
        row.CornerRadius = CornerRadius(8)
        row.Background = isl_brush("#01000000")
        row.Cursor = AnnCursors.Hand if present else AnnCursors.Arrow
        row.Opacity = 1.0 if present else 0.5
        tip = u"{}\n{}".format(it["fam"], it["typ"])
        if note:
            tip += u"\n\n" + note
        tip += u"\n\nClick — place in the view" if present else u"\n\nNot in this project"
        row.ToolTip = tip

        g = WpfGrid()
        row.Child = g
        for kind in ("auto", "star", "auto", "auto"):
            cd = ColumnDefinition()
            cd.Width = (System.Windows.GridLength.Auto if kind == "auto"
                        else System.Windows.GridLength(1.0, System.Windows.GridUnitType.Star))
            g.ColumnDefinitions.Add(cd)

        thumb = Border()
        thumb.Width = 38
        thumb.Height = 38
        thumb.CornerRadius = CornerRadius(7)
        thumb.Background = isl_brush("#2C2C2E")
        thumb.Margin = Thickness(0, 0, 9, 0)
        holder = WpfGrid()
        glyph = TextBlock()
        glyph.Text = u"\uE7C3"
        glyph.FontFamily = ICON_FONT
        glyph.FontSize = 16
        glyph.Foreground = isl_brush("#636366")
        glyph.HorizontalAlignment = AnnHAlign.Center
        glyph.VerticalAlignment = VerticalAlignment.Center
        image = AnnImage()
        image.Stretch = AnnStretch.Uniform
        image.Margin = Thickness(4)
        holder.Children.Add(glyph)
        holder.Children.Add(image)
        thumb.Child = holder
        WpfGrid.SetColumn(thumb, 0)
        g.Children.Add(thumb)
        cached = a["img"].get(key)
        if cached:
            image.Source = cached
            glyph.Visibility = Visibility.Collapsed
        elif cached is None and present:
            a["imgs"].setdefault(key, []).append((image, glyph))

        text = StackPanel()
        text.VerticalAlignment = VerticalAlignment.Center
        name = TextBlock()
        name.Text = it["typ"]
        name.FontSize = 12.5
        name.FontWeight = FontWeights.SemiBold
        name.TextTrimming = TextTrimming.CharacterEllipsis
        text.Children.Add(name)
        sub = TextBlock()
        sub.Text = it["fam"] + (u" · " + note if note else u"")
        sub.FontSize = 11
        sub.Foreground = isl_brush("#8E8E93")
        sub.TextTrimming = TextTrimming.CharacterEllipsis
        text.Children.Add(sub)
        WpfGrid.SetColumn(text, 1)
        g.Children.Add(text)

        star = self.ann_icon(u"\uE735" if fav else u"\uE734",
                             u"Remove from favorites" if fav else u"To favorites",
                             "#FFB000" if fav else "#8E8E93", lambda k=key: self.ann_toggle_fav(k))
        edit = self.ann_icon(u"\uE70F", u"Description and category", "#8E8E93", lambda k=key: self.ann_edit_open(k))
        star.VerticalAlignment = VerticalAlignment.Center
        edit.VerticalAlignment = VerticalAlignment.Center
        WpfGrid.SetColumn(star, 2)
        WpfGrid.SetColumn(edit, 3)
        g.Children.Add(star)
        g.Children.Add(edit)

        if present:
            def enter(s, e):
                if key not in a["msel"]:
                    row.Background = isl_brush("#0F2A4D")

            def leave(s, e):
                if key not in a["msel"]:
                    row.Background = isl_brush("#01000000")
            row.MouseEnter += enter
            row.MouseLeave += leave

        def row_click(s, e, k=key):
            # Ctrl+click — group selection without placing
            try:
                from System.Windows.Input import Keyboard, ModifierKeys
                ctrl = bool(Keyboard.Modifiers & ModifierKeys.Control)
            except Exception:
                ctrl = False
            if ctrl:
                e.Handled = True
                self.ann_msel_toggle(k)
            elif k in a["msel"]:
                # if already in the group — an ordinary click clears the selection
                e.Handled = True
                self.ann_msel_toggle(k)
            else:
                self.ann_place(k)
        row.MouseLeftButtonUp += row_click
        # highlight if already selected
        if key in a["msel"]:
            row.Background = isl_brush("#17407A")
        return row

    def ann_make_tile(self, it, fav, note):
        a = self.ann
        key = it["key"]
        present = it["present"]
        tile = Border()
        tile.Width = 144
        tile.Margin = Thickness(0, 0, 10, 10)
        tile.Padding = Thickness(6, 4, 6, 8)
        tile.CornerRadius = CornerRadius(10)
        tile.BorderThickness = Thickness(1)
        tile.Background = isl_brush("#161618")
        tile.BorderBrush = isl_brush("#2C2C2E")
        tile.Cursor = AnnCursors.Hand if present else AnnCursors.Arrow
        tile.Opacity = 1.0 if present else 0.5
        tip = u"{}\n{}".format(it["fam"], it["typ"])
        if note:
            tip += u"\n\n" + note
        tip += u"\n\nClick — place in the view" if present else u"\n\nNot in this project"
        tile.ToolTip = tip

        col = StackPanel()
        tile.Child = col
        top = DockPanel()
        top.LastChildFill = False
        star = self.ann_icon(u"\uE735" if fav else u"\uE734",
                             u"Remove from favorites" if fav else u"To favorites",
                             "#FFB000" if fav else "#8E8E93", lambda k=key: self.ann_toggle_fav(k))
        edit = self.ann_icon(u"\uE70F", u"Description and category", "#8E8E93", lambda k=key: self.ann_edit_open(k))
        DockPanel.SetDock(star, Dock.Left)
        DockPanel.SetDock(edit, Dock.Right)
        top.Children.Add(star)
        top.Children.Add(edit)
        col.Children.Add(top)

        holder = WpfGrid()
        holder.Height = 64
        holder.Margin = Thickness(0, 0, 0, 6)
        glyph = TextBlock()
        glyph.Text = u"\uE7C3"
        glyph.FontFamily = ICON_FONT
        glyph.FontSize = 28
        glyph.Foreground = isl_brush("#636366")
        glyph.HorizontalAlignment = AnnHAlign.Center
        glyph.VerticalAlignment = VerticalAlignment.Center
        image = AnnImage()
        image.Stretch = AnnStretch.Uniform
        image.Height = 64
        holder.Children.Add(glyph)
        holder.Children.Add(image)
        col.Children.Add(holder)
        cached = a["img"].get(key)
        if cached:
            image.Source = cached
            glyph.Visibility = Visibility.Collapsed
        elif cached is None and present:
            a["imgs"].setdefault(key, []).append((image, glyph))

        name = TextBlock()
        name.Text = it["typ"]
        name.FontWeight = FontWeights.SemiBold
        name.FontSize = 12
        name.TextWrapping = TextWrapping.Wrap
        name.TextTrimming = TextTrimming.CharacterEllipsis
        name.TextAlignment = System.Windows.TextAlignment.Center
        name.MaxHeight = 34
        col.Children.Add(name)
        fam = TextBlock()
        fam.Text = it["fam"]
        fam.FontSize = 10.5
        fam.Foreground = isl_brush("#8E8E93")
        fam.TextTrimming = TextTrimming.CharacterEllipsis
        fam.TextAlignment = System.Windows.TextAlignment.Center
        col.Children.Add(fam)
        if note:
            nt = TextBlock()
            nt.Text = note
            nt.FontSize = 10.5
            nt.FontStyle = AnnFontStyles.Italic
            nt.Foreground = isl_brush("#A1A1A6")
            nt.TextWrapping = TextWrapping.Wrap
            nt.TextTrimming = TextTrimming.CharacterEllipsis
            nt.TextAlignment = System.Windows.TextAlignment.Center
            nt.MaxHeight = 28
            nt.Margin = Thickness(0, 4, 0, 0)
            col.Children.Add(nt)

        if present:
            def enter(s, e):
                if key not in a["msel"]:
                    tile.Background = isl_brush("#0F2A4D")
                    tile.BorderBrush = isl_brush("#2F6FD1")

            def leave(s, e):
                if key not in a["msel"]:
                    tile.Background = isl_brush("#161618")
                    tile.BorderBrush = isl_brush("#2C2C2E")
            tile.MouseEnter += enter
            tile.MouseLeave += leave

        def tile_click(s, e, k=key):
            # Ctrl+click — group selection without placing
            try:
                from System.Windows.Input import Keyboard, ModifierKeys
                ctrl = bool(Keyboard.Modifiers & ModifierKeys.Control)
            except Exception:
                ctrl = False
            if ctrl:
                e.Handled = True
                self.ann_msel_toggle(k)
            elif k in a["msel"]:
                # if already in the group — an ordinary click clears the selection
                e.Handled = True
                self.ann_msel_toggle(k)
            else:
                self.ann_place(k)
        tile.MouseLeftButtonUp += tile_click
        # highlight if already selected
        if key in a["msel"]:
            tile.Background = isl_brush("#17407A")
            tile.BorderBrush = isl_brush("#2F6FD1")
        return tile

    def ann_delete_group(self, group_id, name):
        if not confirm(self.win, u"Delete the group \"{}\" from the project?".format(name)):
            return
        self.run(lambda ua: self.do_delete_group(ua, group_id, name), "delete_group")

    def do_delete_group(self, uiapp, group_id, name):
        uidoc = uiapp.ActiveUIDocument
        if uidoc is None:
            return
        doc = uidoc.Document
        gt = doc.GetElement(revit_id(group_id))
        if gt is None:
            return
        t = Transaction(doc, u"Delete annotation group")
        t.Start()
        try:
            doc.Delete(gt.Id)
            t.Commit()
            self.set_status(u"Group \"{}\" deleted.".format(name))
            self.ann["filter"] = ANN_ALL
            self.ann_load_groups(doc)
        except Exception as ex:
            t.RollBack()
            self.set_status(u"Could not delete the group: {}".format(ex))

    def ann_render_groups_page(self):
        self.pnlAnnGroups.Children.Clear()
        a = self.ann
        sel_count = len(a.get("sel_ids", []))
        groups = a.get("groups", [])
        self.tbAnnSub.Text = u"Annotation groups  ·  {} saved in the project  ·  clicking \"Insert\" places the group in the view".format(len(groups))
        try:
            self.cardAnnSet.Visibility = Visibility.Collapsed
        except Exception:
            pass

        # 1. Top card: Saving a new group
        create_card = Border()
        create_card.Background = isl_brush("#1C1C1E")
        create_card.BorderBrush = isl_brush("#2F6FD1" if sel_count > 0 else "#3A3A3C")
        create_card.BorderThickness = Thickness(1.5 if sel_count > 0 else 1)
        create_card.CornerRadius = CornerRadius(12)
        create_card.Padding = Thickness(16, 12, 16, 14)
        create_card.Margin = Thickness(0, 0, 8, 16)

        c_sp = StackPanel()
        create_card.Child = c_sp

        hdr = TextBlock()
        hdr.Text = u"📦 SAVE SELECTION AS A GROUP"
        hdr.FontSize = 12
        hdr.FontWeight = FontWeights.Bold
        hdr.Foreground = isl_brush("#60A5FA" if sel_count > 0 else "#8E8E93")
        hdr.Margin = Thickness(0, 0, 0, 6)
        c_sp.Children.Add(hdr)

        hint = TextBlock()
        if sel_count > 0:
            hint.Text = u"Revit currently has {} elements selected in the view. Enter a name and click \"Save\":".format(sel_count)
            hint.Foreground = isl_brush("#F5F5F7")
        else:
            hint.Text = u"Select a group of annotations (markers, dimensions, a detail) on the drawing in Revit and come back here to save it."
            hint.Foreground = isl_brush("#8E8E93")
        hint.Margin = Thickness(0, 0, 0, 10)
        hint.TextWrapping = TextWrapping.Wrap
        c_sp.Children.Add(hint)

        row = WpfGrid()
        c_sp.Children.Add(row)
        cd1 = ColumnDefinition()
        cd1.Width = System.Windows.GridLength(1.0, System.Windows.GridUnitType.Star)
        cd2 = ColumnDefinition()
        cd2.Width = System.Windows.GridLength.Auto
        row.ColumnDefinitions.Add(cd1)
        row.ColumnDefinitions.Add(cd2)

        tb_name = TextBox()
        tb_name.MinHeight = 34
        tb_name.Padding = Thickness(10, 6, 10, 6)
        num = len(groups) + 1
        tb_name.Text = u"Detail {}".format(num)
        WpfGrid.SetColumn(tb_name, 0)
        row.Children.Add(tb_name)

        btn_save = Button()
        btn_save.Style = self.win.FindResource("BtnPrimary") if self.win.TryFindResource("BtnPrimary") else None
        btn_save.Content = u"Save group"
        btn_save.Margin = Thickness(8, 0, 0, 0)
        btn_save.Cursor = AnnCursors.Hand
        WpfGrid.SetColumn(btn_save, 1)
        row.Children.Add(btn_save)

        def do_save(s=None, e=None):
            n = (tb_name.Text or u"").strip()
            self.run(lambda ua, name=n: self.do_create_ann_group(ua, name), "save_group")
        btn_save.Click += do_save
        tb_name.KeyDown += lambda s, e: (setattr(e, "Handled", True), do_save()) if e.Key == System.Windows.Input.Key.Enter else None

        self.pnlAnnGroups.Children.Add(create_card)

        # 2. List of saved groups
        sec_title = TextBlock()
        sec_title.Text = u"SAVED GROUPS IN THE PROJECT ({})".format(len(groups))
        sec_title.FontSize = 11.5
        sec_title.FontWeight = FontWeights.SemiBold
        sec_title.Foreground = isl_brush("#8E8E93")
        sec_title.Margin = Thickness(4, 0, 0, 10)
        self.pnlAnnGroups.Children.Add(sec_title)

        if not groups:
            empty_box = Border()
            empty_box.Background = isl_brush("#141416")
            empty_box.CornerRadius = CornerRadius(10)
            empty_box.Padding = Thickness(20)
            empty_box.Margin = Thickness(0, 0, 8, 0)
            em_sp = StackPanel()
            empty_box.Child = em_sp
            em_t = TextBlock()
            em_t.Text = u"There are no saved groups in this model yet."
            em_t.FontWeight = FontWeights.SemiBold
            em_t.Foreground = isl_brush("#A1A1A6")
            em_sp.Children.Add(em_t)
            em_s = TextBlock()
            em_s.Text = u"Select the needed detail on the drawing (for example markers and dimensions around a detail) and save it with the form above."
            em_s.Foreground = isl_brush("#636366")
            em_s.Margin = Thickness(0, 4, 0, 0)
            em_s.TextWrapping = TextWrapping.Wrap
            em_sp.Children.Add(em_s)
            self.pnlAnnGroups.Children.Add(empty_box)
            self.ann_show_empty(u"")
            return

        for g in groups:
            card = Border()
            card.Background = isl_brush("#1C1C1E")
            card.BorderBrush = isl_brush("#2C2C2E")
            card.BorderThickness = Thickness(1)
            card.CornerRadius = CornerRadius(10)
            card.Padding = Thickness(14, 12, 14, 12)
            card.Margin = Thickness(0, 0, 8, 8)

            g_dp = DockPanel()
            card.Child = g_dp

            btn_panel = StackPanel()
            btn_panel.Orientation = Orientation.Horizontal
            DockPanel.SetDock(btn_panel, Dock.Right)

            chk_ungroup = CheckBox()
            chk_ungroup.Content = u"Ungroup after insertion"
            chk_ungroup.Foreground = isl_brush("#8E8E93")
            chk_ungroup.VerticalAlignment = VerticalAlignment.Center
            chk_ungroup.Margin = Thickness(0, 0, 12, 0)
            chk_ungroup.Cursor = AnnCursors.Hand
            btn_panel.Children.Add(chk_ungroup)

            btn_place = Button()
            btn_place.Style = self.win.FindResource("BtnPrimary") if self.win.TryFindResource("BtnPrimary") else None
            btn_place.Content = u"▶  Insert in view"
            btn_place.Cursor = AnnCursors.Hand
            btn_place.Click += lambda s, e, gid=g["id"], chk=chk_ungroup: self.ann_place_group(gid, chk.IsChecked == True)
            btn_panel.Children.Add(btn_place)

            del_btn = Button()
            del_btn.Style = self.win.FindResource("IconBtnDanger") if self.win.TryFindResource("IconBtnDanger") else None
            del_btn.Content = u"\uE74D"
            del_btn.ToolTip = u"Delete this group from the project"
            del_btn.Margin = Thickness(8, 0, 0, 0)
            del_btn.Cursor = AnnCursors.Hand
            del_btn.Click += lambda s, e, gid=g["id"], gn=g["name"]: self.ann_delete_group(gid, gn)
            btn_panel.Children.Add(del_btn)

            g_dp.Children.Add(btn_panel)

            left_sp = StackPanel()
            left_sp.VerticalAlignment = VerticalAlignment.Center
            t_nm = TextBlock()
            t_nm.Text = u"📦  " + g["name"]
            t_nm.FontWeight = FontWeights.SemiBold
            t_nm.FontSize = 13.5
            t_nm.Foreground = isl_brush("#F5F5F7")
            left_sp.Children.Add(t_nm)
            t_sub = TextBlock()
            t_sub.Text = u"Detail Group  ·  click \"Insert\" ➔ click a point in Revit"
            t_sub.FontSize = 11
            t_sub.Foreground = isl_brush("#8E8E93")
            t_sub.Margin = Thickness(20, 2, 0, 0)
            left_sp.Children.Add(t_sub)
            g_dp.Children.Add(left_sp)

            self.pnlAnnGroups.Children.Add(card)

        self.ann_show_empty(u"")

    def ann_render(self):
        a = self.ann
        cfg = self.ann_cfg()
        favs, cats, notes = set(cfg["favs"]), cfg["cats"], cfg["notes"]
        items = a["items"]
        compact = bool(getattr(self, "cp", None) and self.cp["on"])
        q = (self.tbAnnSearch.Text or u"").strip().lower()

        def ucat(it):
            return (cats.get(it["key"]) or u"").strip()

        # --- navigation on the left ---
        user_cats = {}
        none_count = 0
        for it in items:
            c = ucat(it)
            if c:
                user_cats[c] = user_cats.get(c, 0) + 1
            else:
                none_count += 1
        ann_groups = a.get("groups", [])
        nav = [(ANN_ALL, u"All", len(items), u"\uE8FD"),
               (ANN_FAV, u"Favorites", len([1 for it in items if it["key"] in favs]), u"\uE735"),
               (ANN_GROUPS, u"Annotation groups", len(ann_groups), u"\uE71D")]
        if cfg["sets"]:
            nav.append((None, u"SETS", 0, u""))
            for st in cfg["sets"]:
                nav.append((u"set:" + st["name"], st["name"], len(st["keys"]), u"\uE838"))
        if user_cats:
            nav.append((None, u"CATEGORIES", 0, u""))
        for c in sorted(user_cats, key=lambda c: nat(c)):
            nav.append((c, c, user_cats[c], u"\uE8B7"))
        if none_count and user_cats:
            nav.append((ANN_NONE, u"No category", none_count, u"\uE8B7"))
        if a["filter"] not in [n[0] for n in nav]:
            a["filter"] = ANN_ALL
        a["navbusy"] = True
        try:
            self.lstAnnNav.Items.Clear()
            for tag, label, count, glyph in nav:
                if tag is None:
                    hi = ListBoxItem()
                    hi.IsEnabled = False
                    hi.Focusable = False
                    hi.Padding = Thickness(8, 12, 8, 2)
                    ht = TextBlock()
                    ht.Text = label
                    ht.FontSize = 11
                    ht.FontWeight = FontWeights.SemiBold
                    ht.Foreground = isl_brush("#8E8E93")
                    hi.Content = ht
                    self.lstAnnNav.Items.Add(hi)
                    continue
                li = ListBoxItem()
                li.Tag = tag
                li.Padding = Thickness(8, 6, 8, 6)
                row = DockPanel()
                ic = TextBlock()
                ic.Text = glyph
                ic.FontFamily = ICON_FONT
                ic.FontSize = 13
                ic.Width = 22
                ic.Foreground = isl_brush("#FFB000" if tag == ANN_FAV else "#8E8E93")
                ic.VerticalAlignment = VerticalAlignment.Center
                DockPanel.SetDock(ic, Dock.Left)
                row.Children.Add(ic)
                cnt = TextBlock()
                cnt.Text = unicode(count)
                cnt.Foreground = isl_brush("#8E8E93")
                cnt.VerticalAlignment = VerticalAlignment.Center
                DockPanel.SetDock(cnt, Dock.Right)
                # the quick-insert ▶ button only for groups or sets
                if tag is not None and tag.startswith(u"group:"):
                    play_btn = Border()
                    play_btn.CornerRadius = CornerRadius(11)
                    play_btn.Height = 22
                    play_btn.Padding = Thickness(9, 0, 9, 0)
                    play_btn.Margin = Thickness(4, 0, 0, 0)
                    play_btn.Background = ann_brush(u"#0071E3")
                    play_btn.Cursor = AnnCursors.Hand
                    gid = int(tag[6:])
                    play_btn.ToolTip = u"Insert the group \"{}\" in the view (pick a point)".format(label)
                    play_tb = TextBlock()
                    play_tb.Text = u"▶"
                    play_tb.FontSize = 10
                    play_tb.FontWeight = FontWeights.SemiBold
                    play_tb.Foreground = ann_brush(u"#FFFFFF")
                    play_tb.VerticalAlignment = VerticalAlignment.Center
                    play_btn.Child = play_tb
                    play_btn.MouseLeftButtonUp += lambda s, e, g_id=gid: (setattr(e, "Handled", True), self.ann_place_group(g_id))
                    DockPanel.SetDock(play_btn, Dock.Right)
                    row.Children.Add(play_btn)
                elif tag is not None and tag.startswith(u"set:") and count > 0:
                    play_btn = Border()
                    play_btn.CornerRadius = CornerRadius(11)
                    play_btn.Height = 22
                    play_btn.Padding = Thickness(9, 0, 9, 0)
                    play_btn.Margin = Thickness(4, 0, 0, 0)
                    play_btn.Background = ann_brush(u"#0071E3")
                    play_btn.Cursor = AnnCursors.Hand
                    sname = tag[4:]
                    play_btn.ToolTip = u"Insert all {} annotations of the set \"{}\" one by one".format(count, sname)
                    play_tb = TextBlock()
                    play_tb.Text = u"\u25B6 All"
                    play_tb.FontSize = 11
                    play_tb.FontWeight = FontWeights.SemiBold
                    play_tb.Foreground = ann_brush(u"#FFFFFF")
                    play_tb.VerticalAlignment = VerticalAlignment.Center
                    play_btn.Child = play_tb
                    play_btn.MouseLeftButtonUp += lambda s, e, sn=sname: (setattr(e, "Handled", True), self.ann_place_set(sn))
                    DockPanel.SetDock(play_btn, Dock.Right)
                    row.Children.Add(play_btn)
                row.Children.Add(cnt)
                tb = TextBlock()
                tb.Text = label
                tb.TextTrimming = TextTrimming.CharacterEllipsis
                tb.VerticalAlignment = VerticalAlignment.Center
                row.Children.Add(tb)
                li.Content = row
                self.lstAnnNav.Items.Add(li)
                if tag == a["filter"]:
                    li.IsSelected = True
        finally:
            a["navbusy"] = False

        # --- groups page display ---
        flt = a["filter"]
        if flt == ANN_GROUPS or flt.startswith(u"group:"):
            self.ann_render_groups_page()
            return

        def shown(it):
            if flt == ANN_FAV and it["key"] not in favs:
                return False
            if flt == ANN_NONE and ucat(it):
                return False
            if flt.startswith(u"set:"):
                st = self.ann_set_get(flt[4:])
                if st is None or it["key"] not in st["keys"]:
                    return False
            elif flt not in (ANN_ALL, ANN_FAV, ANN_NONE) and ucat(it) != flt:
                return False
            if q:
                hay = u" ".join([it["typ"], it["fam"], notes.get(it["key"], u""), ucat(it), it["rcat"]]).lower()
                return q in hay
            return True

        chosen = [it for it in items if shown(it)]
        mine, auto = {}, {}
        for it in chosen:
            c = ucat(it)
            if c:
                mine.setdefault(c, []).append(it)
            else:
                auto.setdefault(it["rcat"] or u"Not in the project", []).append(it)
        groups = [(c, mine[c], False) for c in sorted(mine, key=lambda c: nat(c))]
        groups += [(c, auto[c], True) for c in sorted(auto, key=lambda c: nat(c))]

        # --- tiles ---
        a["imgs"] = {}
        self.pnlAnnGroups.Children.Clear()

        # --- "▶ Insert all" banner for the active set ---
        if flt.startswith(u"set:") and chosen and not q:
            set_name = flt[4:]
            present_keys = [it["key"] for it in chosen if it["present"]]
            if present_keys:
                banner = Border()
                banner.CornerRadius = CornerRadius(10)
                banner.Background = isl_brush("#17407A")
                banner.BorderBrush = isl_brush("#2F6FD1")
                banner.BorderThickness = Thickness(1)
                banner.Padding = Thickness(14, 8, 14, 8)
                banner.Margin = Thickness(0, 0, 0, 12)
                banner.Cursor = AnnCursors.Hand
                banner.ToolTip = u"Place all {} annotations of the set \"{}\" one by one (Esc after each — next)".format(
                    len(present_keys), set_name)
                ban_sp = StackPanel()
                ban_sp.Orientation = Orientation.Horizontal
                ban_ic = TextBlock()
                ban_ic.Text = u"\u25B6"
                ban_ic.FontSize = 14
                ban_ic.Foreground = isl_brush("#60A5FA")
                ban_ic.VerticalAlignment = VerticalAlignment.Center
                ban_ic.Margin = Thickness(0, 0, 10, 0)
                ban_sp.Children.Add(ban_ic)
                ban_col = StackPanel()
                ban_title = TextBlock()
                ban_title.Text = u"Insert all annotations of the set \"{}\"".format(set_name)
                ban_title.FontWeight = FontWeights.SemiBold
                ban_title.Foreground = isl_brush("#F5F5F7")
                ban_col.Children.Add(ban_title)
                ban_sub = TextBlock()
                ban_sub.Text = u"{} annotations one by one  ·  Esc after each moves on to the next".format(len(present_keys))
                ban_sub.FontSize = 11
                ban_sub.Foreground = isl_brush("#93C5FD")
                ban_sub.Margin = Thickness(0, 2, 0, 0)
                ban_col.Children.Add(ban_sub)
                ban_sp.Children.Add(ban_col)
                banner.Child = ban_sp
                banner.MouseLeftButtonUp += lambda s, e, sn=set_name: self.ann_place_set(sn)
                self.pnlAnnGroups.Children.Add(banner)
        collapsed = set(cfg["collapsed"])
        for gname, members, is_auto in groups:
            gkey = (u"~" if is_auto else u"") + gname
            is_closed = (gkey in collapsed) and not q
            members = sorted(members, key=lambda it: nat(it["typ"]))
            wrap = StackPanel() if compact else AnnWrapPanel()
            wrap.Visibility = Visibility.Collapsed if is_closed else Visibility.Visible
            for it in members:
                maker = self.ann_make_row if compact else self.ann_make_tile
                wrap.Children.Add(maker(it, it["key"] in favs, notes.get(it["key"], u"")))
            hdr = Border()
            hdr.Background = isl_brush("#01000000")
            hdr.Cursor = AnnCursors.Hand
            hdr.Margin = Thickness(0, 4, 0, 8)
            hp = StackPanel()
            hp.Orientation = Orientation.Horizontal
            chev = TextBlock()
            chev.Text = u"\uE76C" if is_closed else u"\uE70D"
            chev.FontFamily = ICON_FONT
            chev.FontSize = 10
            chev.Foreground = isl_brush("#8E8E93")
            chev.VerticalAlignment = VerticalAlignment.Center
            chev.Margin = Thickness(0, 0, 8, 0)
            hp.Children.Add(chev)
            nm = TextBlock()
            nm.Text = gname
            nm.FontSize = 14
            nm.FontWeight = FontWeights.Bold
            nm.Foreground = isl_brush("#8E8E93" if is_auto else "#F5F5F7")
            hp.Children.Add(nm)
            ct = TextBlock()
            ct.Text = u"  {}{}".format(len(members), u"" if (compact or not is_auto) else u"  \u00B7  auto (by Revit category)")
            ct.Foreground = isl_brush("#8E8E93")
            ct.FontSize = 12
            ct.VerticalAlignment = VerticalAlignment.Center
            hp.Children.Add(ct)
            hdr.Child = hp

            def toggle(s, e, gk=gkey, w=wrap, c=chev):
                cc = self.ann_cfg()["collapsed"]
                if w.Visibility == Visibility.Visible:
                    w.Visibility = Visibility.Collapsed
                    c.Text = u"\uE76C"
                    if gk not in cc:
                        cc.append(gk)
                else:
                    w.Visibility = Visibility.Visible
                    c.Text = u"\uE70D"
                    if gk in cc:
                        cc.remove(gk)
                self.ann_save()
            hdr.MouseLeftButtonUp += toggle
            self.pnlAnnGroups.Children.Add(hdr)
            self.pnlAnnGroups.Children.Add(wrap)

        if not items:
            self.ann_show_empty(u"The model has no types from the chosen source.\nChange \"Source\" at the top or add favorites from the selection.")
        elif not chosen:
            self.ann_show_empty(u"Nothing found." if q else
                                (u"No favorites yet: click ☆ on a tile or \"To favorites from selection\"." if flt == ANN_FAV
                                 else (u"The set is empty: click \u270E on an annotation and mark this set."
                                       if flt.startswith(u"set:") else u"This category is empty.")))
        else:
            self.ann_show_empty(u"")
        self.tbAnnSub.Text = u"{} types  \u00B7  {} favorites  \u00B7  clicking a tile puts the annotation on the cursor".format(
            len(items), len([1 for it in items if it["key"] in favs]))
        if compact:
            self.tbAnnSub.Text = u"{} types · {} favorites".format(len(items), len([1 for it in items if it["key"] in favs]))
        self.ann_set_panel_sync()
        self.ann_bar_refresh()
        self.ann_update_banner()
        # we remove from the group selection the keys that are no longer in the current view
        shown_keys = set(it["key"] for it in chosen)
        a["msel"].intersection_update(shown_keys)
        self.ann_msel_banner()

    # ================= Params =================
    def tile_setup(self):
        self.tile = {"ids": [], "meta": {}, "table": None, "params": [], "ro": {}, "bulk": {}, "loaded": False}
        self.btnTUpdate.Click += lambda s, e: self.tile_update()
        self.btnTCols.Click += lambda s, e: self.run(self.do_tile_cols)
        self.btnTBulk.Click += self.on_tile_bulk_toggle
        self.btnTSelect.Click += self.on_tile_select
        self.btnTClear.Click += lambda s, e: self.tile_clear()
        self.btnTApply.Click += self.on_tile_apply
        self.btnTBulkApply.Click += self.on_tile_bulk_apply
        self.tile_show_empty(TILE_HINT)

    def tile_params_for(self, doc):
        names = self.settings.get("tile_params", {}).get(doc.Title)
        return list(names) if names else list(TILE_DEFAULT_PARAMS)

    def tile_save_params(self, doc, names):
        self.settings.setdefault("tile_params", {})[doc.Title] = list(names)
        save_settings(self.settings)

    def tile_show_empty(self, text):
        self.tbTEmptyText.Text = text
        self.pnlTEmpty.Visibility = Visibility.Visible

    def tile_dirty(self):
        t = self.tile
        if t["table"] is None:
            return False
        try:
            self.gridT.CommitEdit()
            for row in t["table"].Rows:
                orig = t["meta"][int(row["_i"])][1]
                for i in range(len(t["params"])):
                    new = row["p%d" % i]
                    if (u"" if new is None else unicode(new)) != orig[i]:
                        return True
        except Exception:
            return False
        return False

    def tile_update(self):
        if self.tile_dirty() and not confirm(self.win, u"The table has unapplied changes. Refresh from the selection and lose them?"):
            return
        self.run(self.do_tile_update)

    def do_tile_update(self, uiapp):
        uidoc = uiapp.ActiveUIDocument
        doc = uidoc.Document
        self.tile["ids"] = list(uidoc.Selection.GetElementIds())
        self.tile["params"] = self.tile_params_for(doc)
        self.tile_build(doc)

    def do_tile_first(self, uiapp):
        # first display of the tab: we pick up the current selection, if there is one
        self.tile["loaded"] = True
        uidoc = uiapp.ActiveUIDocument
        self.tile["params"] = self.tile_params_for(uidoc.Document)
        ids = list(uidoc.Selection.GetElementIds())
        if ids:
            self.tile["ids"] = ids
            self.tile_build(uidoc.Document)

    def tile_col(self, header, path, readonly, width):
        c = TileGridTextColumn()
        c.Header = header
        b = TileBinding(path)
        b.Mode = TileBindingMode.OneWay if readonly else TileBindingMode.TwoWay
        c.Binding = b
        c.IsReadOnly = readonly
        if readonly:
            c.Foreground = BrushConverter().ConvertFromString("#8E8E93")
        if width:
            c.Width = TileGridLength(width)
        else:
            c.Width = TileGridLength(1, TileGridLengthUnit.Star)
            c.MinWidth = 120
        self.gridT.Columns.Add(c)

    def tile_build(self, doc):
        t = self.tile
        params = t["params"]
        groups = OrderedDict()
        skipped = 0
        seen = dict((n, [0, 0]) for n in params)   # [editable, read-only]
        for eid in t["ids"]:
            el = doc.GetElement(eid)
            if el is None:
                continue
            vals = []
            for name in params:
                p, from_type = tile_param(el, name)
                if p is None:
                    vals.append(None)
                    continue
                seen[name][1 if (from_type or p.IsReadOnly) else 0] += 1
                if p.StorageType == DB.StorageType.String:
                    vals.append(p.AsString() or u"")
                else:
                    vals.append(p.AsValueString() or u"")
            if all(v is None for v in vals):
                skipped += 1
                continue
            key = tuple(v if v is not None else u"" for v in vals)
            g = groups.setdefault(key, ([], set()))
            g[0].append(eid)
            g[1].add(el.Category.Name if el.Category else u"?")
        t["ro"] = dict((n, seen[n][0] == 0 and seen[n][1] > 0) for n in params)
        tk_log(u'tile_build: groups {}, elements {}, columns {}'.format(len(groups), len(t['ids']), len(params)))

        dt = TileDataTable()
        dt.Columns.Add("_i", int)
        dt.Columns.Add("count", int)
        dt.Columns.Add("cat", str)
        for i in range(len(params)):
            dt.Columns.Add("p%d" % i, str)
        t["meta"] = {}
        total = 0
        for idx, (key, g) in enumerate(groups.items()):
            t["meta"][idx] = (g[0], list(key))
            dt.Rows.Add(Array[object]([idx, len(g[0]), u", ".join(sorted(g[1]))] + list(key)))
            total += len(g[0])
        t["table"] = dt

        tk_log(u'tile_build: the table is assembled, updating the DataGrid')
        self.gridT.CommitEdit()
        self.gridT.ItemsSource = None
        self.gridT.Columns.Clear()
        self.tile_col(u"Qty", "count", True, 64)
        self.tile_col(u"Category", "cat", True, 140)
        for i, name in enumerate(params):
            self.tile_col(tile_title(name), "p%d" % i, t["ro"].get(name, False), None)
        self.gridT.ItemsSource = dt.DefaultView
        self.tile_build_bulk()
        if groups:
            self.pnlTEmpty.Visibility = Visibility.Collapsed
        elif t["ids"]:
            self.tile_show_empty(u"The selected elements have none of the chosen parameters. Change the columns.")
        else:
            self.tile_show_empty(TILE_HINT)
        self.tbTSub.Text = u"Groups: {}  ·  elements: {}  ·  without parameters: {}  ·  columns: {}".format(
            len(groups), total, skipped, len(params))
        self.set_status(u"")

    def tile_clear(self):
        t = self.tile
        self.gridT.CommitEdit()
        self.gridT.ItemsSource = None
        t["ids"], t["meta"], t["table"] = [], {}, None
        self.tbTSub.Text = u""
        self.tile_build_bulk()
        self.tile_show_empty(TILE_HINT)
        self.set_status(u"Cleared.")

    def tile_build_bulk(self):
        t = self.tile
        self.pnlBulkRows.Children.Clear()
        t["bulk"] = {}
        try:
            switch_style = self.win.FindResource("Switch")
        except Exception:
            switch_style = None
        for name in t["params"]:
            if t["ro"].get(name):
                continue
            row = TileGrid()
            c1, c2, c3 = TileColumn(), TileColumn(), TileColumn()
            c1.Width = TileGridLengthStruct(52)
            c2.Width = TileGridLengthStruct(210)
            c3.Width = TileGridLengthStruct(1, TileGridLengthUnit.Star)
            row.ColumnDefinitions.Add(c1)
            row.ColumnDefinitions.Add(c2)
            row.ColumnDefinitions.Add(c3)
            row.Margin = Thickness(0, 3, 0, 3)
            chk = CheckBox()
            if switch_style is not None:
                chk.Style = switch_style
            chk.HorizontalAlignment = TileHAlign.Left
            label = TextBlock()
            label.Text = tile_title(name)
            label.VerticalAlignment = VerticalAlignment.Center
            label.TextTrimming = TextTrimming.CharacterEllipsis
            label.ToolTip = tile_title(name)
            TileGrid.SetColumn(label, 1)
            box = TileTextBox()
            TileGrid.SetColumn(box, 2)
            row.Children.Add(chk)
            row.Children.Add(label)
            row.Children.Add(box)
            self.pnlBulkRows.Children.Add(row)
            t["bulk"][name] = (chk, box)

    def on_tile_bulk_toggle(self, s, e):
        opened = self.cardBulk.Visibility != Visibility.Visible
        self.cardBulk.Visibility = Visibility.Visible if opened else Visibility.Collapsed

    def on_tile_apply(self, s, e):
        self.gridT.CommitEdit()
        self.run(lambda ua: self.tile_apply_all(ua.ActiveUIDocument.Document), label=u"Params: apply changes", wrap=True)

    def on_tile_bulk_apply(self, s, e):
        t = self.tile
        if t["table"] is None:
            return
        self.gridT.CommitEdit()
        rows = list(self.gridT.SelectedItems) or list(t["table"].DefaultView)
        touched = 0
        for i, name in enumerate(t["params"]):
            pair = t["bulk"].get(name)
            if pair and pair[0].IsChecked:
                for rv in rows:
                    rv["p%d" % i] = pair[1].Text or u""
                touched += 1
        if not touched:
            self.set_status(u"Turn on at least one parameter in the bulk edit.")
            return
        self.run(lambda ua: self.tile_apply_all(ua.ActiveUIDocument.Document), label=u"Params: apply changes", wrap=True)

    def tile_apply_all(self, doc):
        t = self.tile
        if t["table"] is None:
            self.set_status(u"The table is empty.")
            return
        changed, failed = 0, 0
        tr = DB.Transaction(doc, "Params")
        tr.Start()
        try:
            for row in t["table"].Rows:
                ids, orig = t["meta"][int(row["_i"])]
                for i, name in enumerate(t["params"]):
                    new = row["p%d" % i]
                    new = u"" if new is None else unicode(new)
                    if new == orig[i]:
                        continue
                    for eid in ids:
                        if tile_set(doc.GetElement(eid), name, new):
                            changed += 1
                        else:
                            failed += 1
            tr.Commit()
        except Exception:
            tr.RollBack()
            raise
        self.tile_build(doc)
        self.set_status(u"Written: {}, failed: {}".format(changed, failed))

    def on_tile_select(self, s, e):
        t = self.tile
        if t["table"] is None:
            return
        ids = List[DB.ElementId]()
        for rv in self.gridT.SelectedItems:
            for eid in t["meta"][int(rv["_i"])][0]:
                ids.Add(eid)
        self.run(lambda ua: ua.ActiveUIDocument.Selection.SetElementIds(ids))

    def do_tile_cols(self, uiapp):
        uidoc = uiapp.ActiveUIDocument
        doc = uidoc.Document
        t = self.tile
        ids = list(t["ids"]) or list(uidoc.Selection.GetElementIds())
        if not ids:
            self.set_status(u"First select elements in Revit: the list of available parameters is built from them.")
            return
        cand = tile_candidates(doc, ids)
        current = t["params"] or self.tile_params_for(doc)
        names = sorted(set(cand) | set(current), key=lambda n: tile_title(n).lower())
        choices = [(tile_label(n, cand.get(n)), n) for n in names]
        try:
            chosen = choose(u"Table columns",
                            u"Check the parameters to show in the table. The choice is remembered for this project.",
                            choices, multi=True, preset=lambda v: v in current, owner=self.win)
        except Cancelled:
            return
        ordered = [n for n in current if n in chosen] + [n for n in chosen if n not in current]
        self.tile_save_params(doc, ordered)
        t["params"] = ordered
        t["ids"] = ids
        self.tile_build(doc)

    # ================= View naming: shared sets sidebar + scopes (set / group / sheet) =================
    def nm_cfg_for(self, doc):
        root = self.settings.setdefault("naming2", {})
        cfg = root.get(doc.Title)
        if not isinstance(cfg, dict):
            cfg = {}
            root[doc.Title] = cfg
        if not isinstance(cfg.get("keywords"), list):
            cfg["keywords"] = list(NM_DEFAULT_KEYWORDS)
        if not isinstance(cfg.get("template"), basestring):
            cfg["template"] = NM_DEFAULT_TEMPLATE
        if not isinstance(cfg.get("base"), int):
            cfg["base"] = 0
        if not isinstance(cfg.get("modes"), dict):
            cfg["modes"] = {}
        if not isinstance(cfg.get("sets"), dict):
            cfg["sets"] = {}
        for name, sc in list(cfg["sets"].items()):      # transition from the old format (single values per set)
            if not isinstance(sc, dict):
                cfg["sets"][name] = {"nodes": {}}
                continue
            if not isinstance(sc.get("nodes"), dict):
                node = {}
                if isinstance(sc.get("values"), dict):
                    vals = dict((k, x) for k, x in sc["values"].items() if isinstance(x, basestring) and x.strip())
                    if vals:
                        node["values"] = vals
                if isinstance(sc.get("template"), basestring) and sc["template"].strip():
                    node["template"] = sc["template"]
                sc["nodes"] = {u"": node} if node else {}
                sc.pop("values", None)
                sc.pop("template", None)
        return cfg

    def nm_nodes(self):
        sc = self.nm["cfg"]["sets"].setdefault(self.cur_name, {"nodes": {}})
        return sc.setdefault("nodes", {})

    def nm_mode(self, kw):
        cfg = self.nm["cfg"]
        sc = cfg["sets"].get(self.cur_name) or {}
        m = (sc.get("modes") or {}).get(kw) or cfg["modes"].get(kw) or NM_DEFAULT_MODES.get(kw.upper(), u"group")
        return m if m in NM_MODE_MAX else u"group"

    def nm_modes(self):
        return dict((kw, self.nm_mode(kw)) for kw in self.nm["cfg"]["keywords"])

    def nm_set_configured(self, name):
        """Whether the set has its own naming settings (for the label in the sidebar)."""
        try:
            sc = self.settings.get("naming2", {}).get(self.doc_title, {}).get("sets", {}).get(name) or {}
            return any(bool(n) for n in (sc.get("nodes") or {}).values())
        except Exception:
            return False

    def nm_setup(self):
        self.nm = {"loaded": False, "doc": None, "cfg": None, "data": None, "taken": None,
                   "plan": [], "dirty": False, "scope": u""}
        self.nm_ui = {"nodes": {}, "views": {}}
        self._nm_fill = False
        self.nm_boxes = []
        for text in NM_BASE_MODES:
            item = ComboBoxItem()
            item.Content = text
            self.cbNmBase.Items.Add(item)
        self.cbNmBase.SelectedIndex = 0
        bind_hint(self.tbNmTemplate, self.hNmTemplate)
        self.tbNmTemplate.TextChanged += lambda s, e: self.on_nm_edit(s, e)
        self.cbNmBase.SelectionChanged += lambda s, e: self.on_nm_edit(s, e)
        self.btnNmAddKw.Click += lambda s, e: self.run(self.do_nm_addkw)
        self.btnNmApply.Click += lambda s, e: self.on_nm_apply(s, e)
        self.btnNmResetScope.Click += lambda s, e: self.nm_reset_scope()
        timer = DispatcherTimer()
        timer.Interval = TimeSpan.FromMilliseconds(250)
        timer.Tick += lambda s, e: self.on_nm_tick(s, e)
        self.nm["timer"] = timer
        self.btnNmApply.IsEnabled = False
        self.nm_clear(NM_EMPTY_HINT)

    # ---------- choosing a set in the shared sidebar ----------
    def nm_set_changed(self):
        """The user chose another set (the list is shared with Print Sets): we re-read only it."""
        self.nm_flush()
        self.nm["scope"] = u""
        self.nm["data"] = None
        self.nm_clear(u"Reading the views of the set…")
        self.tbNmTitle.Text = self.cur_name
        self.run(self.do_nm_first, "nmfirst")

    # ---------- loading from Revit ----------
    def do_nm_first(self, uiapp):
        doc = uiapp.ActiveUIDocument.Document
        force = bool(self.nm.pop("force", False))
        if self.nm["doc"] != doc.Title:
            self.nm["doc"] = doc.Title
            self.nm["data"] = None
            self.nm["taken"] = None
            self.nm["scope"] = u""
            force = True
        self.nm["cfg"] = self.nm_cfg_for(doc)
        self.nm["loaded"] = True
        if not self.sets:
            self.nm_clear(u"Sets are still being indexed…")
            return
        name = self.cur_name
        if name not in self.sets:
            self.nm["data"] = None
            self.nm_clear(NM_EMPTY_HINT)
            return
        d = self.nm["data"]
        if force or d is None or d["set"] != name:
            if force:
                self.nm["taken"] = None
            self.nm_load(doc)
        else:
            self.nm_refresh()

    def do_nm_load(self, uiapp):
        self.nm_load(uiapp.ActiveUIDocument.Document)

    def nm_taken(self, doc):
        if self.nm["taken"] is None:
            self.nm["taken"] = nm_collect_taken(doc)
        return self.nm["taken"]

    def nm_load(self, doc):
        name = self.cur_name
        cfg = self.nm["cfg"]
        pairs = []
        for vid in self.sets.get(name, []):
            m = self.meta_cache.get(vid)
            if m is None or m["kind"] != 0:
                continue
            el = doc.GetElement(revit_id(vid))
            if isinstance(el, ViewSheet) and not el.IsPlaceholder:
                pairs.append((m, el))
        rows = nm_read_rows(doc, pairs, cfg["keywords"])
        self.nm_taken(doc)
        self.nm["data"] = {"set": name, "rows": rows, "sheets": len(pairs), "pnames": nm_param_names(doc, rows)}
        valid = set([u""])
        for r in rows:
            valid.update(r["keys"])
        if self.nm["scope"] not in valid:
            self.nm["scope"] = u""
        self.tbNmTitle.Text = name
        self.nm_build_list()
        self.nm_apply_scope_cfg()
        self.nm_refresh()

    def nm_fetch_param(self, doc, kw):
        """For a new keyword we read the values from the already loaded views."""
        d = self.nm["data"]
        if not d:
            return
        for r in d["rows"]:
            view = doc.GetElement(revit_id(r["view_id"]))
            pv = nm_param(view, kw) if view is not None else None
            if pv is not None:
                r["params"][kw.upper()] = pv
            else:
                r["params"].pop(kw.upper(), None)

    # ---------- grouped list (as in Print Sets) ----------
    def nm_bar(self, key, text, count, level, is_group):
        b = Border()
        b.CornerRadius = CornerRadius(7 if is_group else 5)
        b.Background = isl_k(u"HEAD_BG") if is_group else Brushes.Transparent
        b.Margin = Thickness(level * INDENT, 6 if (is_group and level <= 1) else 2, 0, 1)
        b.Padding = Thickness(10, 5 if is_group else 4, 8, 5 if is_group else 4)
        b.Cursor = Cursors.Hand
        b.Tag = key
        dp = DockPanel()
        if count is not None:
            c = TextBlock()
            c.Text = unicode(count)
            c.Foreground = isl_k(u"GRAY")
            c.Margin = Thickness(8, 0, 0, 0)
            c.VerticalAlignment = VerticalAlignment.Center
            DockPanel.SetDock(c, Dock.Right)
            dp.Children.Add(c)
        dot = TextBlock()
        dot.Foreground = isl_k(u"BLUE")
        dot.Margin = Thickness(8, 0, 0, 0)
        dot.VerticalAlignment = VerticalAlignment.Center
        dot.ToolTip = u"Has own settings"
        DockPanel.SetDock(dot, Dock.Right)
        dp.Children.Add(dot)
        t = TextBlock()
        t.Text = text
        t.FontWeight = FontWeights.SemiBold if is_group else FontWeights.Normal
        t.TextTrimming = TextTrimming.CharacterEllipsis
        t.VerticalAlignment = VerticalAlignment.Center
        t.Foreground = isl_k(u"NM_DARK")
        dp.Children.Add(t)
        b.Child = dp
        b.MouseLeftButtonUp += lambda s, e: self.nm_select_scope(unicode(s.Tag))
        self.nm_ui["nodes"][key] = (b, t, dot, is_group, 0 if key == u"" else (1 if is_group else 2))
        return b

    def nm_view_row(self, r, level):
        b = Border()
        b.Background = Brushes.Transparent
        b.Margin = Thickness(level * INDENT, 0, 0, 0)
        b.Padding = Thickness(10, 2, 8, 2)
        b.Cursor = Cursors.Hand
        b.Tag = r["keys"][-1]
        g = WpfGrid()
        for w in (NmGridLength(1, NmGridUnit.Star), NmGridLength(22), NmGridLength(1.3, NmGridUnit.Star),
                  NmGridLength(1, NmGridUnit.Star)):
            cd = ColumnDefinition()
            cd.Width = w
            g.ColumnDefinitions.Add(cd)
        cur = TextBlock()
        cur.Text = r["cur"]
        cur.ToolTip = r["cur"]
        cur.Foreground = isl_k(u"GRAY")
        cur.FontSize = 12
        cur.TextTrimming = TextTrimming.CharacterEllipsis
        arrow = TextBlock()
        arrow.Text = u"\u2192"
        arrow.Foreground = isl_k(u"GRAY")
        arrow.HorizontalAlignment = System.Windows.HorizontalAlignment.Center
        new = TextBlock()
        new.FontSize = 12
        new.TextTrimming = TextTrimming.CharacterEllipsis
        st = TextBlock()
        st.FontSize = 12
        st.Margin = Thickness(12, 0, 0, 0)
        st.TextTrimming = TextTrimming.CharacterEllipsis
        for i, c in enumerate((cur, arrow, new, st)):
            WpfGrid.SetColumn(c, i)
            g.Children.Add(c)
        b.Child = g
        b.MouseLeftButtonUp += lambda s, e: self.nm_select_scope(unicode(s.Tag))
        self.nm_ui["views"][r["view_id"]] = (new, st)
        return b

    def nm_build_list(self):
        d = self.nm["data"]
        self.pnlNmList.Children.Clear()
        self.nm_ui = {"nodes": {}, "views": {}}
        rows = d["rows"]
        counts, seen = {}, set()
        for r in rows:
            if r["sheet_id"] in seen:
                continue
            seen.add(r["sheet_id"])
            for key in r["keys"][1:-1]:
                counts[key] = counts.get(key, 0) + 1
        self.pnlNmList.Children.Add(self.nm_bar(u"", u"Whole set", d["sheets"], 0, True))
        prev_f, prev_sheet = [], None
        for r in rows:
            f = r["folders"]
            if r["sheet_id"] != prev_sheet:
                k = 0
                while k < len(f) and k < len(prev_f) and f[k] == prev_f[k]:
                    k += 1
                for lvl in range(k, len(f)):
                    key = r["keys"][lvl + 1]
                    self.pnlNmList.Children.Add(self.nm_bar(key, f[lvl], counts.get(key, 0), lvl + 1, True))
                self.pnlNmList.Children.Add(self.nm_bar(r["keys"][-1], r["sheet"], None, len(f) + 1, False))
                prev_f, prev_sheet = f, r["sheet_id"]
            self.pnlNmList.Children.Add(self.nm_view_row(r, len(f) + 2))

    def nm_paint(self):
        if not self.nm.get("cfg") or self.cur_name not in self.sets:
            return
        nodes = self.nm_nodes()
        modes = self.nm_modes()
        for key, (b, t, dot, is_group, level) in self.nm_ui["nodes"].items():
            sel = (key == self.nm["scope"])
            b.Background = isl_k(u"BLUE_SOFT") if sel else (isl_k(u"HEAD_BG") if is_group else Brushes.Transparent)
            t.Foreground = isl_k(u"BLUE") if sel else isl_k(u"NM_DARK")
            dot.Text = u"\u25CF" if nm_node_active(nodes.get(key), level, modes) else u""

    def nm_update_list(self, plan):
        for r in plan:
            ui = self.nm_ui["views"].get(r["view_id"])
            if ui is None:
                continue
            new, st = ui
            new.Text = r["new"] if r["new"] else u"\u2014"
            new.ToolTip = r["new"]
            st.Text = r["status"]
            st.ToolTip = r["status"]
            st.Foreground = {"ok": isl_k(u"NM_OKBLUE"), "conflict": isl_k(u"NM_RED"), "error": isl_k(u"NM_RED")}.get(r["st"], isl_k(u"GRAY"))
            new.Foreground = isl_k(u"NM_RED") if r["st"] in ("conflict", "error") else isl_k(u"NM_DARK")
        self.nm_paint()

    # ---------- scopes (set / group / sheet) ----------
    def nm_scope_rows(self, key):
        rows = self.nm["data"]["rows"] if self.nm.get("data") else []
        return rows if key == u"" else [r for r in rows if key in r["keys"]]

    def nm_scope_level(self, key):
        rows = self.nm_scope_rows(key)
        if key == u"" or not rows:
            return 0
        return 2 if key == rows[0]["keys"][-1] else 1

    def nm_select_scope(self, key):
        if key == self.nm["scope"] or self.nm.get("data") is None:
            return
        self.nm_flush()
        self.nm["scope"] = key
        self.nm_apply_scope_cfg()
        self.nm_paint()
        self.nm_refresh()

    def nm_reset_scope(self):
        if self.nm.get("data") is None:
            return
        self.nm_nodes().pop(self.nm["scope"], None)
        self.nm["dirty"] = False
        save_settings(self.settings)
        self.nm_apply_scope_cfg()
        self.nm_touch_set_sub()
        self.nm_refresh()

    def nm_set_mode(self, kw, mode):
        cfg = self.nm["cfg"]
        if mode not in NM_MODE_MAX or self.nm_mode(kw) == mode:
            return
        self.nm_flush()
        sc = cfg["sets"].setdefault(self.cur_name, {"nodes": {}})
        sc.setdefault("modes", {})[kw] = mode
        cfg["modes"][kw] = mode                  # new sets take the last choice
        save_settings(self.settings)
        self.nm_apply_scope_cfg()
        self.nm_refresh()

    def nm_inherited(self, kw):
        """What the scope inherits for the word (hint text)."""
        key = self.nm["scope"]
        srows = self.nm_scope_rows(key)
        if not srows:
            return u""
        keys = srows[0]["keys"]
        idx = keys.index(key) if key in keys else 0
        nodes = self.nm_nodes()
        for k in reversed(keys[:idx]):
            v = ((nodes.get(k) or {}).get("values") or {}).get(kw)
            if isinstance(v, basestring) and v.strip():
                return u"inherited: {}".format(v.strip())
        vals = set((r["params"].get(kw.upper()) or (None, u"", False))[1] for r in srows)
        if len(vals) == 1:
            v = list(vals)[0]
            return u"from the view: {}".format(v) if v else u"empty in the views"
        return u"different values in the views"

    def nm_inherited_template(self):
        key = self.nm["scope"]
        srows = self.nm_scope_rows(key)
        if srows:
            keys = srows[0]["keys"]
            idx = keys.index(key) if key in keys else 0
            nodes = self.nm_nodes()
            for k in reversed(keys[:idx]):
                v = (nodes.get(k) or {}).get("template")
                if isinstance(v, basestring) and v.strip():
                    return v.strip()
        return self.nm["cfg"]["template"]

    def nm_kw_warning(self, kw, srows):
        if not srows:
            return u""
        miss = sum(1 for r in srows if kw.upper() not in r["params"])
        ro = sum(1 for r in srows if kw.upper() in r["params"] and r["params"][kw.upper()][2])
        if miss == len(srows):
            return u"not in the views"
        if miss:
            return u"not in {}".format(miss)
        if ro == len(srows):
            return u"read-only"
        if ro:
            return u"reading: {}".format(ro)
        return u""

    def nm_mode_switch(self, kw, mode):
        box = Border()
        self.mod_set(box, Border.BackgroundProperty, u"#1C1C1E")
        box.CornerRadius = CornerRadius(15)
        box.Padding = Thickness(2)
        box.Margin = Thickness(0, 0, 0, 6)
        box.HorizontalAlignment = System.Windows.HorizontalAlignment.Left
        row = StackPanel()
        row.Orientation = Orientation.Horizontal
        for code, title in NM_MODES:
            seg = Border()
            seg.CornerRadius = CornerRadius(13)
            seg.Height = 26
            seg.Padding = Thickness(12, 0, 12, 0)
            seg.Cursor = Cursors.Hand
            seg.Tag = kw + u"\u0001" + code
            seg.ToolTip = {u"all": u"One value for the whole set",
                           u"group": u"A separate value for each group / subgroup",
                           u"sheet": u"A separate value for each sheet"}[code]
            on = (code == mode)
            if on:
                seg.Background = ann_brush(u"#0071E3")
            else:
                seg.Background = Brushes.Transparent
            t = TextBlock()
            t.Text = title
            t.FontSize = 11.5
            t.FontWeight = FontWeights.SemiBold
            t.VerticalAlignment = VerticalAlignment.Center
            if on:
                t.Foreground = ann_brush(u"#FFFFFF")
            else:
                t.Foreground = isl_k(u"GRAY")
            seg.Child = t
            seg.MouseLeftButtonUp += lambda s, e: self.nm_set_mode(*unicode(s.Tag).split(u"\u0001"))
            row.Children.Add(seg)
        box.Child = row
        return box

    def nm_kw_cell(self, kw, value, hint, warn, mode, editable):
        cell = StackPanel()
        cell.Width = 236
        cell.Margin = Thickness(0, 0, 14, 10)
        head = DockPanel()
        head.Margin = Thickness(2, 0, 0, 5)
        rm = Button()
        rm.Style = self.win.TryFindResource(u"IconBtn")
        rm.Content = u"\uE711"
        rm.Width = 22
        rm.Height = 22
        rm.FontSize = 10
        rm.ToolTip = u"Remove the word \"{}\" from the project".format(kw)
        rm.Tag = kw
        rm.Click += lambda s, e: self.nm_remove_kw(unicode(s.Tag))
        DockPanel.SetDock(rm, Dock.Right)
        head.Children.Add(rm)
        if warn:
            w = TextBlock()
            w.Text = warn
            w.FontSize = 11
            w.Foreground = isl_k(u"NM_RED")
            w.Margin = Thickness(6, 0, 6, 0)
            w.VerticalAlignment = VerticalAlignment.Center
            DockPanel.SetDock(w, Dock.Right)
            head.Children.Add(w)
        t = TextBlock()
        t.Text = kw
        t.FontWeight = FontWeights.SemiBold
        t.TextTrimming = TextTrimming.CharacterEllipsis
        t.ToolTip = kw
        t.VerticalAlignment = VerticalAlignment.Center
        head.Children.Add(t)
        cell.Children.Add(head)
        cell.Children.Add(self.nm_mode_switch(kw, mode))
        g = WpfGrid()
        box = WpfTextBox()
        box.Text = value if editable else u""
        box.IsEnabled = editable
        h = TextBlock()
        h.Text = hint
        h.Foreground = isl_k(u"GRAY")
        h.Margin = Thickness(10, 0, 10, 0)
        h.VerticalAlignment = VerticalAlignment.Center
        h.IsHitTestVisible = False
        h.TextTrimming = TextTrimming.CharacterEllipsis
        h.Visibility = Visibility.Collapsed if (value and editable) else Visibility.Visible
        bind_hint(box, h)
        box.TextChanged += lambda s, e: self.on_nm_edit(s, e)
        g.Children.Add(box)
        g.Children.Add(h)
        cell.Children.Add(g)
        return cell, box

    def nm_apply_scope_cfg(self):
        """Show the settings of the chosen scope: own values, word modes and hints about what is inherited."""
        cfg = self.nm["cfg"]
        key = self.nm["scope"]
        node = self.nm_nodes().get(key) or {}
        vals = node.get("values") if isinstance(node.get("values"), dict) else {}
        srows = self.nm_scope_rows(key)
        level = self.nm_scope_level(key)
        sheets = len(set(r["sheet_id"] for r in srows))
        if key == u"":
            title, sub = u"Whole set", u"The values apply to all sheets of the set if the word is not set to \"Groups\" or \"Sheets\" and there are no own settings below"
        elif level == 2:
            title, sub = srows[0]["sheet"], u"This sheet only  ·  views: {}".format(len(srows))
        else:
            title, sub = key.split(NM_SEP)[-1], u"Group  ·  sheets: {}  ·  views: {}".format(sheets, len(srows))
        self.tbNmScope.Text = title
        self.tbNmScope.ToolTip = title
        self.tbNmScopeSub.Text = sub
        self.btnNmResetScope.Visibility = Visibility.Visible if node else Visibility.Collapsed
        self._nm_fill = True
        try:
            self.pnlNmKw.Children.Clear()
            self.nm_boxes = []
            for kw in cfg["keywords"]:
                mode = self.nm_mode(kw)
                editable = level <= NM_MODE_MAX[mode]
                if editable:
                    hint = self.nm_inherited(kw)
                else:
                    hint = u"set for the whole set" if mode == u"all" else u"set for groups"
                cell, box = self.nm_kw_cell(kw, vals.get(kw, u""), hint, self.nm_kw_warning(kw, srows), mode, editable)
                self.pnlNmKw.Children.Add(cell)
                self.nm_boxes.append((kw, box))
            self.tbNmKwEmpty.Visibility = Visibility.Collapsed if cfg["keywords"] else Visibility.Visible
            own = node.get("template") if isinstance(node.get("template"), basestring) else u""
            if key == u"" and not own:
                own = cfg["template"]
            self.tbNmTemplate.Text = own
            self.hNmTemplate.Text = (u"inherited: " + self.nm_inherited_template()) if key != u"" else u""
            self.hNmTemplate.Visibility = Visibility.Collapsed if own else Visibility.Visible
            self.cbNmBase.SelectedIndex = cfg["base"] if 0 <= cfg["base"] < len(NM_BASE_MODES) else 0
            self.nm_build_chips()
        finally:
            self._nm_fill = False

    def nm_build_chips(self):
        self.pnlNmChips.Children.Clear()
        toks = [u"VIEW"] + list(self.nm["cfg"]["keywords"])
        for tok in toks:
            chip = Border()
            self.mod_set(chip, Border.BackgroundProperty, u"#1C1C1E")
            chip.CornerRadius = CornerRadius(12)
            chip.Height = 24
            chip.Padding = Thickness(10, 0, 10, 0)
            chip.Margin = Thickness(0, 0, 6, 6)
            chip.Cursor = Cursors.Hand
            chip.ToolTip = u"Insert {" + tok + u"} into the template"
            chip.Tag = tok
            t = TextBlock()
            t.Text = u"{" + tok + u"}"
            t.FontSize = 12
            t.FontWeight = FontWeights.SemiBold
            t.VerticalAlignment = VerticalAlignment.Center
            self.mod_set(t, TextBlock.ForegroundProperty, u"#2997FF", True)
            chip.Child = t
            chip.MouseEnter += lambda s, e: self.mod_set(s, Border.BackgroundProperty, u"#2C2C2E")
            chip.MouseLeave += lambda s, e: self.mod_set(s, Border.BackgroundProperty, u"#1C1C1E")
            chip.MouseLeftButtonUp += lambda s, e: self.nm_insert_token(unicode(s.Tag))
            self.pnlNmChips.Children.Add(chip)

    def nm_insert_token(self, tok):
        tb = self.tbNmTemplate
        text = tb.Text or u""
        pos = tb.SelectionStart
        ins = u"{" + tok + u"}"
        tb.Text = text[:pos] + ins + text[pos + tb.SelectionLength:]
        tb.SelectionStart = pos + len(ins)
        tb.SelectionLength = 0
        tb.Focus()

    def nm_remove_kw(self, kw):
        cfg = self.nm["cfg"]
        if kw not in cfg["keywords"]:
            return
        self.nm_flush()
        cfg["keywords"].remove(kw)
        for sc in cfg["sets"].values():
            for node in (sc.get("nodes") or {}).values():
                if isinstance(node.get("values"), dict):
                    node["values"].pop(kw, None)
        save_settings(self.settings)
        self.nm_apply_scope_cfg()
        self.nm_touch_set_sub()
        self.nm_refresh()

    def do_nm_addkw(self, uiapp):
        cfg = self.nm["cfg"]
        d = self.nm["data"]
        if cfg is None or d is None:
            return
        doc = uiapp.ActiveUIDocument.Document
        have = set(k.upper() for k in cfg["keywords"])
        choices = [(u"Enter the name manually…", u"\u0000custom")]
        for n in d["pnames"]:
            if n.upper() not in have:
                choices.append((n, n))
        try:
            val = choose(u"New keyword",
                         u"A view parameter (text). Its value is set for a set, group or sheet, written into the views and substituted into the name.",
                         choices, owner=self.win)
            if val == u"\u0000custom":
                res = fields(u"New keyword", u"The exact view parameter name, as in Properties.",
                             [("name", u"Parameter name", u"", False)])
                val = res["name"]
        except Cancelled:
            return
        val = (val or u"").strip()
        if not val or val.upper() in have or val.upper() == u"VIEW":
            return
        self.nm_flush()
        cfg["keywords"].append(val)
        save_settings(self.settings)
        self.nm_fetch_param(doc, val)
        self.nm_apply_scope_cfg()
        self.nm_refresh()

    # ---------- saving settings ----------
    def nm_values(self):
        return dict((kw, box.Text or u"") for kw, box in self.nm_boxes)

    def nm_flush(self):
        """Write the form state to the settings of the chosen scope (empty value = inherit)."""
        cfg = self.nm.get("cfg")
        if (cfg is None or self.cur_name not in self.sets or self.nm.get("data") is None
                or self.nm["data"]["set"] != self.cur_name or not self.nm["dirty"]):
            return
        key = self.nm["scope"]
        nodes = self.nm_nodes()
        node = nodes.setdefault(key, {})
        old = node.get("values") if isinstance(node.get("values"), dict) else {}
        vals = {}
        for kw, box in self.nm_boxes:
            if not box.IsEnabled:                        # the word is not edited here: we keep the stored value
                if kw in old:
                    vals[kw] = old[kw]
                continue
            t = (box.Text or u"").strip()
            if t:
                vals[kw] = t
        if vals:
            node["values"] = vals
        else:
            node.pop("values", None)
        tmpl = (self.tbNmTemplate.Text or u"").strip()
        if tmpl:
            node["template"] = tmpl
            if key == u"":
                cfg["template"] = tmpl       # default template for sets without their own
        else:
            node.pop("template", None)
        if not node:
            nodes.pop(key, None)
        cfg["base"] = max(0, self.cbNmBase.SelectedIndex)
        self.nm["dirty"] = False
        save_settings(self.settings)

    def on_nm_edit(self, s, e):
        if self._nm_fill or self.nm.get("data") is None:
            return
        self.nm["dirty"] = True
        t = self.nm["timer"]
        t.Stop()
        t.Start()

    def nm_touch_set_sub(self):
        """Refresh the set label in the sidebar without rebuilding the list."""
        tb = self.set_subs.get(self.cur_name)
        if tb is not None:
            tb.Text = self.set_sub_text(self.cur_name)

    def on_nm_tick(self, s, e):
        self.nm["timer"].Stop()
        self.nm_flush()
        self.nm_touch_set_sub()
        self.btnNmResetScope.Visibility = Visibility.Visible if self.nm_nodes().get(self.nm["scope"]) else Visibility.Collapsed
        self.nm_refresh()

    # ---------- preview ----------
    def nm_show_empty(self, text):
        self.tbNmEmptyText.Text = text
        self.pnlNmEmpty.Visibility = Visibility.Visible

    def nm_clear(self, text):
        try:
            self.pnlNmList.Children.Clear()
        except Exception:
            pass
        self.nm_ui = {"nodes": {}, "views": {}}
        self.nm_show_empty(text)
        self.tbNmSub.Text = u""
        self.tbNmScope.Text = u""
        self.tbNmScopeSub.Text = u""
        self.btnNmResetScope.Visibility = Visibility.Collapsed
        self.btnNmApply.IsEnabled = False
        self.btnNmApply.Content = u"Apply"

    def nm_refresh(self):
        d = self.nm["data"]
        cfg = self.nm["cfg"]
        if d is None or cfg is None:
            return
        plan = nm_plan(d["rows"], self.nm["taken"] or {}, cfg["keywords"], self.nm_modes(), self.nm_nodes(),
                       cfg["template"], max(0, self.cbNmBase.SelectedIndex))
        self.nm["plan"] = plan
        self.nm_summary(plan, d["sheets"])
        self.nm_update_list(plan)

    def nm_summary(self, plan, sheet_count):
        counts = dict((k, sum(1 for r in plan if r["st"] == k)) for k in ("ok", "same", "conflict", "error"))
        if plan:
            self.pnlNmEmpty.Visibility = Visibility.Collapsed
        else:
            self.nm_show_empty(u"There are no views to name on the sheets of this set.")
        self.tbNmSub.Text = (u"Sheets: {}  ·  views: {}  ·  will change: {}  ·  unchanged: {}  ·  conflicts: {}  ·  errors: {}"
                             .format(sheet_count, len(plan), counts["ok"], counts["same"], counts["conflict"], counts["error"]))
        self.btnNmApply.IsEnabled = counts["ok"] > 0
        self.btnNmApply.Content = u"Apply ({})".format(counts["ok"]) if counts["ok"] else u"Apply"
        if self.tab == 3:
            self.set_status(u"Click a set, group or sheet to configure it separately. The preview updates as you type; nothing is written to the model."
                            if plan else u"")

    # ---------- applying ----------
    def on_nm_apply(self, s, e):
        self.nm_flush()
        self.run(self.do_nm_apply, "nmapply")

    def do_nm_apply(self, uiapp):
        self.nm_apply(uiapp.ActiveUIDocument.Document)

    def nm_apply(self, doc):
        todo = [r for r in self.nm["plan"] if r["st"] == "ok"]
        if not todo:
            self.set_status(u"Nothing to apply.")
            return
        renamed, written, failures = self.nm_write(doc, todo)
        self.nm["taken"] = None                          # names changed: the cache of taken names is stale
        self.nm_load(doc)
        self.set_status(u"Views renamed: {}  ·  values written: {}  ·  skipped: {}".format(renamed, written, len(failures)))
        self.nm_report(failures)

    def nm_report(self, failures, caption=u"View naming: notes"):
        if not failures:
            return
        was_top = self.win.Topmost
        self.win.Topmost = False
        try:
            show_report(caption, u"\n".join(failures))
        finally:
            self.win.Topmost = was_top

    def nm_write(self, doc, todo, extra=None, name=u"Naming views"):
        """Renaming views and writing their parameters in one transaction; extra() runs in the same one."""
        failures, renamed, written = [], 0, 0
        views, ready = {}, []
        for r in todo:
            v = doc.GetElement(revit_id(r["view_id"]))
            if v is None or v.Name != r["cur"]:
                failures.append(u"{} · {}: the view changed in the model, click \"Refresh\"".format(r["sheet"], r["cur"]))
                continue
            views[r["view_id"]] = v
            ready.append(r)
        tr = DB.Transaction(doc, name)
        tr.Start()
        try:
            for r in ready:                            # phase 1: temporary names so that swaps do not conflict
                if r["new"] != r["cur"]:
                    views[r["view_id"]].Name = u"zz_nm_tmp_{}".format(r["view_id"])
            for r in ready:                            # phase 2: final names and parameter values
                view = views[r["view_id"]]
                if r["new"] != r["cur"]:
                    try:
                        view.Name = r["new"]
                        renamed += 1
                    except Exception as exc:
                        failures.append(u"{} · {}: {}".format(r["sheet"], r["cur"], err_text(exc)))
                        try:
                            view.Name = r["cur"]
                        except Exception:
                            pass
                for pname, value in r["writes"]:
                    p = view.LookupParameter(pname)
                    if p is None or p.IsReadOnly or p.StorageType != DB.StorageType.String:
                        failures.append(u"{} · {}: the parameter \"{}\" is not writable".format(r["sheet"], r["cur"], pname))
                        continue
                    try:
                        if p.Set(value):
                            written += 1
                        else:
                            failures.append(u"{} · {}: could not write \"{}\"".format(r["sheet"], r["cur"], pname))
                    except Exception as exc:
                        failures.append(u"{} · {}: «{}»: {}".format(r["sheet"], r["cur"], pname, err_text(exc)))
            if extra is not None:
                extra()
            tr.Commit()
        except Exception:
            tr.RollBack()
            raise
        return renamed, written, failures


    # ---------- helpers ----------
    def run(self, func, key=None, label=None, wrap=False):
        if self.closed:
            return
        if key is not None and any(k == key for k, _ in self.handler.queue):
            return
        if label:
            try:
                func._tkx_meta = (label, bool(wrap))     # for lambdas; methods are recognized by name (TKX_FN_LABELS)
            except Exception:
                pass
        self.handler.queue.append((key, func))
        self.ev.Raise()

    def request_reindex(self):
        self.set_status(u"Indexing sets and sheets…")
        self.run(self.do_reindex, "reindex")

    def set_status(self, msg):
        if self.closed:
            return
        self.ann_bar_hint(msg)
        if self.tab == 5:
            self.txtAnnStatus.Text = msg
        elif self.tab == 3:
            self.txtNStatus.Text = msg
        elif self.tab == 2:
            self.txtTStatus.Text = msg
        elif self.tab == 6:
            self.tbModStatus.Text = msg
        elif self.tab == 1:
            self.tbToolsStatus.Text = msg
        elif self.tab == 4:
            self.tbHomeStatus.Text = msg
        else:
            self.txtStatus.Text = msg

    def label(self, v):
        if isinstance(v, ViewSheet):
            return u"{} - {}".format(v.SheetNumber, v.Name)
        return u"[View] {}".format(v.Name)

    def sorted_items(self, items):
        m = SORT_MODES[self.sort_mode][0]
        if m == "number":
            key = lambda i: (i["kind"], nat(i["num"]), nat(i["name"]))
        elif m == "name":
            key = lambda i: (i["kind"], nat(i["name"]), nat(i["num"]))
        elif m == "added":
            key = lambda i: (i["kind"], i["ord"], nat(i["num"]))
        else:
            key = lambda i: (i["kind"], [nat(f) for f in i["folders"]], nat(i["num"]), nat(i["name"]))
        return sorted(items, key=key)

    def get_bo(self, doc):
        try:
            return (BrowserOrganization.GetCurrentBrowserOrganizationForSheets(doc),
                    BrowserOrganization.GetCurrentBrowserOrganizationForViews(doc))
        except Exception:
            return None, None

    def cache_meta(self, v, bo_s, bo_v):
        vid = v.Id.IntegerValue
        if vid in self.meta_cache:
            return
        is_sheet = isinstance(v, ViewSheet)
        folders = []
        try:
            bo = bo_s if is_sheet else bo_v
            if bo is not None:
                folders = [unicode(i.Name) for i in bo.GetFolderItems(v.Id)]
        except Exception:
            folders = []
        revs = []
        if is_sheet:
            try:
                revs = [r.IntegerValue for r in v.GetAdditionalRevisionIds()]
            except Exception:
                revs = []
        self.meta_cache[vid] = {"id": vid, "label": self.label(v), "revs": revs,
                                "num": v.SheetNumber if is_sheet else u"",
                                "name": v.Name, "kind": 0 if is_sheet else 1,
                                "folders": folders}

    def read_set(self, s, bo_s, bo_v):
        ids = []
        for v in s.Views:
            self.cache_meta(v, bo_s, bo_v)
            ids.append(v.Id.IntegerValue)
        return ids

    def build_items(self, ids, ord_idx=None):
        out = []
        for vid in ids:
            m = self.meta_cache.get(vid)
            if m is None:
                continue
            d = dict(m)
            d["flag"] = vid in self.sel_set
            d["ord"] = (ord_idx or {}).get(vid, 10 ** 6)
            out.append(d)
        return out

    def current_items(self):
        ids = self.sets.get(self.cur_name, [])
        saved = self.orders.get(self.doc_title, {}).get(self.cur_name, [])
        return self.build_items(ids, dict((vid, n) for n, vid in enumerate(saved)))

    def ord_get(self, doc, name):
        return self.orders.get(doc.Title, {}).get(name, [])

    def ord_set(self, doc, name, ids):
        self.orders.setdefault(doc.Title, {})[name] = [int(i) for i in ids]
        save_orders(self.orders)

    def ord_del(self, doc, name):
        self.orders.get(doc.Title, {}).pop(name, None)
        save_orders(self.orders)

    def merged_order(self, doc, name, existing_views, new_views):
        cur = [v.Id.IntegerValue for v in existing_views]
        order = [i for i in self.ord_get(doc, name) if i in cur]
        for v in sorted(existing_views, key=sort_key):
            if v.Id.IntegerValue not in order:
                order.append(v.Id.IntegerValue)
        for v in sorted(new_views, key=sort_key):
            if v.Id.IntegerValue not in order:
                order.append(v.Id.IntegerValue)
        return order

    def get_selected_views(self, uidoc):
        doc = uidoc.Document
        items = []
        for eid in uidoc.Selection.GetElementIds():
            el = doc.GetElement(eid)
            if isinstance(el, ViewSheet):
                items.append(el)
            elif isinstance(el, View) and not el.IsTemplate and el.CanBePrinted:
                items.append(el)
        items.sort(key=sort_key)
        return items

    def get_sets(self, doc):
        return dict((s.Name, s) for s in FilteredElementCollector(doc).OfClass(ViewSheetSet))

    def to_viewset(self, views):
        vs = ViewSet()
        for v in views:
            vs.Insert(v)
        return vs

    def setup_pm(self, doc):
        pm = doc.PrintManager
        pm.PrintRange = PrintRange.Select
        return pm, pm.ViewSheetSetting

    # ---------- rendering (UI thread, from the cache only) ----------
    def set_sub_text(self, name):
        n = len(self.sets.get(name, []))
        return u"{} sheets".format(n) + (u"  \u00B7  configured" if self.nm_set_configured(name) else u"")

    def set_item(self, name):
        it = ListBoxItem()
        it.Tag = name
        it.ToolTip = name
        dp = DockPanel()
        ic = Border()
        ic.Width = 30
        ic.Height = 30
        ic.CornerRadius = CornerRadius(7)
        ic.Background = isl_k(u"BLUE_SOFT")
        ic.Margin = Thickness(0, 0, 10, 0)
        g = TextBlock()
        g.FontFamily = ICON_FONT
        g.Text = u"\uE8F1"
        g.FontSize = 15
        g.Foreground = isl_k(u"BLUE")
        g.HorizontalAlignment = System.Windows.HorizontalAlignment.Center
        g.VerticalAlignment = VerticalAlignment.Center
        ic.Child = g
        DockPanel.SetDock(ic, Dock.Left)
        dp.Children.Add(ic)
        sp = StackPanel()
        sp.VerticalAlignment = VerticalAlignment.Center
        t1 = TextBlock()
        t1.Text = name
        t1.FontWeight = FontWeights.SemiBold
        t1.TextTrimming = TextTrimming.CharacterEllipsis
        t2 = TextBlock()
        t2.Text = self.set_sub_text(name)
        t2.Foreground = isl_k(u"GRAY")
        t2.FontSize = 11.5
        t2.TextTrimming = TextTrimming.CharacterEllipsis
        sp.Children.Add(t1)
        sp.Children.Add(t2)
        dp.Children.Add(sp)
        it.Content = dp
        self.set_subs[name] = t2
        return it

    def render_sets(self):
        """Shared list of sets (Print Sets and Views). Built only when the set list or search changes."""
        q = (self.tbSetSearch.Text or u"").strip().lower()
        sv = find_sv(self.lstSets)
        off = sv.VerticalOffset if sv is not None else 0
        self._filling = True
        try:
            self.lstSets.Items.Clear()
            self.set_subs = {}
            picked = None
            for name in sorted(self.sets.keys(), key=lambda x: x.lower()):
                if q and q not in name.lower():
                    continue
                it = self.set_item(name)
                self.lstSets.Items.Add(it)
                if name == self.cur_name:
                    picked = it
            if picked is not None:
                self.lstSets.SelectedItem = picked
            self.lstSets.UpdateLayout()
            sv = find_sv(self.lstSets)
            if sv is not None:
                sv.ScrollToVerticalOffset(off)
        finally:
            self._filling = False

    def update_state(self):
        exists = self.cur_name in self.sets
        nsel = len(self.sel_ids)
        if exists:
            self.tbTitle.Text = self.cur_name
            self.tbSub.Text = u"{} sheets  \u00B7  selected in Revit: {}".format(
                len(self.sets[self.cur_name]), nsel)
        else:
            self.tbTitle.Text = u"Selection"
            self.tbSub.Text = u"{} in Revit  \u00B7  pick a set on the left or create a new one".format(nsel)
        for b in (self.btnSelRevit, self.btnPrint, self.btnDup, self.btnRename,
                  self.btnDelete, self.btnRemove, self.btnPrintOrd, self.btnMakeSets):
            b.IsEnabled = exists
        self.btnAdd.IsEnabled = exists and nsel > 0
        self.btnReplace.IsEnabled = exists and nsel > 0
        self.home_refresh()

    def make_header(self, text, lvl, count, tag, leaf):
        it = ListBoxItem()
        it.Tag = tag
        it.Margin = Thickness(0, 8 if lvl == 0 else 3, 0, 1)
        bd = Border()
        bd.Background = isl_k(u"HEAD_BG")
        bd.CornerRadius = CornerRadius(6)
        bd.Padding = Thickness(8, 3, 6, 3)
        bd.Margin = Thickness(lvl * INDENT, 0, 0, 0)
        dp = DockPanel()
        if leaf:
            btn = Button()
            btn.Content = u"Print" if self.exp_fmt() == u"pdf" else u"Export"
            btn.Style = self.win.FindResource("BtnSm")
            btn.ToolTip = u"Send this group to print"
            btn.Click += (lambda t: (lambda s, e: self.on_print_group(t)))(tag)
            DockPanel.SetDock(btn, Dock.Right)
            dp.Children.Add(btn)
        c = TextBlock()
        c.Text = unicode(count)
        c.Foreground = isl_k(u"GRAY")
        c.Margin = Thickness(8, 0, 8, 0)
        c.VerticalAlignment = VerticalAlignment.Center
        DockPanel.SetDock(c, Dock.Right)
        t = TextBlock()
        t.Text = text
        t.FontWeight = FontWeights.SemiBold
        t.TextTrimming = TextTrimming.CharacterEllipsis
        t.VerticalAlignment = VerticalAlignment.Center
        dp.Children.Add(c)
        dp.Children.Add(t)
        bd.Child = dp
        it.Content = bd
        return it

    def render_items(self):
        exists = self.cur_name in self.sets
        items = self.sorted_items(self.current_items() if exists
                                  else self.build_items(self.sel_ids))
        fq = (self.tbItemSearch.Text or u"").strip().lower()
        grouped = SORT_MODES[self.sort_mode][0] == "browser" and any(i["folders"] for i in items)
        shown = [i for i in items if not fq or fq in i["label"].lower()]

        # number of sheets in each folder (including nested ones) - for headers
        counts = {}
        for i in shown:
            f = i["folders"]
            for lvl in range(len(f)):
                k = (i["kind"], tuple(f[:lvl + 1]))
                counts[k] = counts.get(k, 0) + 1

        self.dots = {}
        self.grp_items = {}
        self.grp_ids = {}
        self._sel_busy = True
        try:
            self.lstItems.Items.Clear()
            prev, prev_kind, open_tags, gcount, n = [], None, [], 0, 0
            for idx, i in enumerate(shown, 1):
                f = i["folders"] if grouped else []
                if i["kind"] != prev_kind:
                    prev, open_tags = [], []
                    prev_kind = i["kind"]
                k = 0
                while k < len(f) and k < len(prev) and f[k] == prev[k]:
                    k += 1
                open_tags = open_tags[:k]
                for lvl in range(k, len(f)):
                    gcount += 1
                    tag = u"g:{}".format(gcount)
                    cnt = counts[(i["kind"], tuple(f[:lvl + 1]))]
                    self.lstItems.Items.Add(self.make_header(f[lvl], lvl, cnt, tag, lvl == len(f) - 1))
                    self.grp_items[tag] = []
                    self.grp_ids[tag] = [f[lvl], []]
                    open_tags.append(tag)
                    if lvl == len(f) - 1:
                        n = 0
                prev = f
                n = n + 1 if grouped else idx

                it = ListBoxItem()
                it.Tag = i["id"]
                dp = DockPanel()
                dp.Margin = Thickness(len(f) * INDENT, 0, 0, 0)
                num = TextBlock()
                num.Text = unicode(n)
                num.Foreground = isl_k(u"GRAY")
                num.Width = 30
                DockPanel.SetDock(num, Dock.Left)
                dot = TextBlock()
                dot.Text = u"\u25CF" if (i["flag"] and exists) else u""
                dot.Foreground = isl_k(u"BLUE")
                dot.Width = 18
                DockPanel.SetDock(dot, Dock.Left)
                self.dots[i["id"]] = dot
                t = TextBlock()
                t.Text = i["label"]
                t.TextTrimming = TextTrimming.CharacterEllipsis
                dp.Children.Add(num)
                dp.Children.Add(dot)
                rl = sorted([self.revs[r] for r in i.get("revs", []) if r in self.revs],
                            key=lambda x: x["seq"])
                if rl:
                    bg = TextBlock()
                    bg.Text = u"Rev " + u", ".join([x["num"] for x in rl])
                    bg.Foreground = isl_k(u"BLUE")
                    bg.FontSize = 11.5
                    bg.Margin = Thickness(8, 0, 4, 0)
                    bg.MaxWidth = 170
                    bg.TextTrimming = TextTrimming.CharacterEllipsis
                    bg.VerticalAlignment = VerticalAlignment.Center
                    bg.ToolTip = u"\n".join([u"#{} {} {} {}".format(x["seq"], x["num"], x["date"], x["desc"]) for x in rl])
                    DockPanel.SetDock(bg, Dock.Right)
                    dp.Children.Add(bg)
                dp.Children.Add(t)
                it.Content = dp
                self.lstItems.Items.Add(it)
                for tag in open_tags:
                    self.grp_items[tag].append(it)
                    self.grp_ids[tag][1].append(i["id"])
            self.grp_ids = dict((k, (v[0], v[1])) for k, v in self.grp_ids.items())
        finally:
            self._sel_busy = False
        self.update_state()

    def update_dots(self):
        for vid, dot in self.dots.items():
            dot.Text = u"\u25CF" if vid in self.sel_set else u""
        self.update_state()

    def render_all(self):
        self.render_sets()
        if self.tab == 3:
            self.items_dirty = True
            self.nm["force"] = True
            self.run(self.do_nm_first, "nmfirst")
        else:
            self.render_items()

    # ---------- API actions (Revit context) ----------
    def do_reindex(self, uiapp):
        """Full indexing: all sets and their sheets are read ONCE."""
        t0 = time.time()
        uidoc = uiapp.ActiveUIDocument
        if uidoc is None:
            return self.set_status(u"No document is open.")
        doc = uidoc.Document
        self.doc_title = doc.Title
        self.meta_cache = {}
        self.sets = {}
        self.load_revs(doc)
        bo_s, bo_v = self.get_bo(doc)
        for name, s in self.get_sets(doc).items():
            self.sets[name] = self.read_set(s, bo_s, bo_v)
        if self.cur_name not in self.sets:
            self.cur_name = u""
        self.sync(uiapp, force=True)
        self.set_status(u"Indexed {} sets, {} sheets/views in {:.1f} s.".format(
            len(self.sets), len(self.meta_cache), time.time() - t0))

    def load_revs(self, doc):
        self.revs = {}
        try:
            for eid in Revision.GetAllRevisionIds(doc):
                r = doc.GetElement(eid)
                self.revs[eid.IntegerValue] = {
                    "id": eid.IntegerValue,
                    "seq": r.SequenceNumber,
                    "num": unicode(r.RevisionNumber or u""),
                    "date": unicode(r.RevisionDate or u""),
                    "desc": unicode(r.Description or u""),
                    "by": unicode(r.IssuedBy or u""),
                    "to": unicode(r.IssuedTo or u""),
                    "issued": bool(r.Issued)}
        except Exception:
            self.revs = {}

    def update_sets(self, uiapp, names):
        """After changes we re-read only the affected sets, not everything."""
        doc = uiapp.ActiveUIDocument.Document
        sets = self.get_sets(doc)
        bo_s, bo_v = self.get_bo(doc)
        for n in names:
            s = sets.get(n)
            if s is None:
                self.sets.pop(n, None)
            else:
                self.sets[n] = self.read_set(s, bo_s, bo_v)
        if self.cur_name not in self.sets:
            self.cur_name = u""
        self.sync(uiapp, force=True)

    def do_sync(self, uiapp):
        self.sync(uiapp, force=False)

    def sync(self, uiapp, force):
        uidoc = uiapp.ActiveUIDocument
        if uidoc is None or self.closed:
            return
        doc = uidoc.Document
        if self.doc_title is not None and doc.Title != self.doc_title and not force:
            return self.do_reindex(uiapp)     # switched the project
        sel = self.get_selected_views(uidoc)
        ids = [v.Id.IntegerValue for v in sel]
        changed = (ids != self.sel_ids)
        if changed:
            bo_s, bo_v = self.get_bo(doc)
            for v in sel:
                self.cache_meta(v, bo_s, bo_v)
            self.sel_ids = ids
            self.sel_set = set(ids)
        if force:
            self.render_all()
        elif changed:
            if self.cur_name in self.sets:
                self.update_dots()          # only the dots, without rebuilding the list
            else:
                self.render_items()

    def _save_new(self, doc, views, name):
        t = Transaction(doc, "Create Print Set")
        t.Start()
        try:
            pm, vss = self.setup_pm(doc)
            vss.CurrentViewSheetSet = vss.InSession
            vss.CurrentViewSheetSet.Views = self.to_viewset(views)
            vss.SaveAs(name)
            t.Commit()
        except:
            t.RollBack()
            raise

    def _overwrite(self, doc, existing, views):
        name = existing.Name
        tmp = name + u"__tmp"
        t = Transaction(doc, "Update Print Set")
        t.Start()
        try:
            pm, vss = self.setup_pm(doc)
            leftover = self.get_sets(doc).get(tmp)
            if leftover is not None:
                vss.CurrentViewSheetSet = leftover
                vss.Delete()
            vss.CurrentViewSheetSet = vss.InSession
            vss.CurrentViewSheetSet.Views = self.to_viewset(views)
            vss.SaveAs(tmp)
            vss.CurrentViewSheetSet = existing
            vss.Delete()
            tmp_set = self.get_sets(doc).get(tmp)
            vss.CurrentViewSheetSet = tmp_set
            vss.Rename(name)
            t.Commit()
        except:
            t.RollBack()
            raise
        saved = self.get_sets(doc).get(name)
        return saved.Views.Size if saved else 0

    def do_create(self, uiapp):
        uidoc = uiapp.ActiveUIDocument
        doc = uidoc.Document
        name = (self.tbNew.Text or u"").strip()
        views = self.get_selected_views(uidoc)
        if not name:
            return self.set_status(u"Enter the name of the new set.")
        if not views:
            return self.set_status(u"Nothing is selected in Project Browser.")
        if name in self.get_sets(doc):
            return self.set_status(u"Set '{}' already exists.".format(name))
        self._save_new(doc, views, name)
        self.ord_set(doc, name, [v.Id.IntegerValue for v in sorted(views, key=sort_key)])
        self.cur_name = name
        self.tbNew.Text = u""
        self.update_sets(uiapp, [name])
        self.set_status(u"Created '{}' ({} pcs).".format(name, len(views)))

    def do_add(self, uiapp):
        uidoc = uiapp.ActiveUIDocument
        doc = uidoc.Document
        views = self.get_selected_views(uidoc)
        existing = self.get_sets(doc).get(self.cur_name)
        if existing is None or not views:
            return self.set_status(u"Pick a set and select sheets.")
        merged, seen = [], set()
        for v in list(existing.Views) + views:
            if v.Id.IntegerValue not in seen:
                seen.add(v.Id.IntegerValue)
                merged.append(v)
        merged.sort(key=sort_key)
        added = len(merged) - existing.Views.Size
        order = self.merged_order(doc, self.cur_name, list(existing.Views), views)
        n = self._overwrite(doc, existing, merged)
        self.ord_set(doc, self.cur_name, order)
        self.update_sets(uiapp, [self.cur_name])
        self.set_status(u"Added {}. The set now has {}.".format(added, n))

    def do_replace(self, uiapp):
        uidoc = uiapp.ActiveUIDocument
        doc = uidoc.Document
        views = self.get_selected_views(uidoc)
        existing = self.get_sets(doc).get(self.cur_name)
        if existing is None or not views:
            return self.set_status(u"Pick a set and select sheets.")
        n = self._overwrite(doc, existing, views)
        self.ord_set(doc, self.cur_name, [v.Id.IntegerValue for v in sorted(views, key=sort_key)])
        self.update_sets(uiapp, [self.cur_name])
        self.set_status(u"Contents replaced. The set now has {}.".format(n))

    def do_remove(self, uiapp, ids):
        doc = uiapp.ActiveUIDocument.Document
        existing = self.get_sets(doc).get(self.cur_name)
        if existing is None:
            return
        keep = [v for v in existing.Views if v.Id.IntegerValue not in set(ids)]
        keep.sort(key=sort_key)
        if not keep:
            return self.set_status(u"These are all the sheets of the set. To remove everything, click 'Delete'.")
        removed = existing.Views.Size - len(keep)
        order = self.merged_order(doc, self.cur_name, keep, [])
        n = self._overwrite(doc, existing, keep)
        self.ord_set(doc, self.cur_name, order)
        self.update_sets(uiapp, [self.cur_name])
        self.set_status(u"Removed {}. The set now has {}.".format(removed, n))

    def do_rename(self, uiapp, new):
        doc = uiapp.ActiveUIDocument.Document
        sets = self.get_sets(doc)
        old = self.cur_name
        if old not in sets:
            return
        if new in sets:
            return self.set_status(u"Set '{}' already exists.".format(new))
        t = Transaction(doc, "Rename Print Set")
        t.Start()
        try:
            pm, vss = self.setup_pm(doc)
            vss.CurrentViewSheetSet = sets[old]
            vss.Rename(new)
            t.Commit()
        except:
            t.RollBack()
            raise
        self.ord_set(doc, new, self.ord_get(doc, old))
        self.ord_del(doc, old)
        self.cur_name = new
        self.update_sets(uiapp, [old, new])
        self.set_status(u"Renamed to '{}'.".format(new))

    def do_duplicate(self, uiapp, new):
        doc = uiapp.ActiveUIDocument.Document
        sets = self.get_sets(doc)
        if new in sets:
            return self.set_status(u"Set '{}' already exists.".format(new))
        src = sets.get(self.cur_name)
        if src is None:
            return
        self._save_new(doc, sorted(list(src.Views), key=sort_key), new)
        self.ord_set(doc, new, self.merged_order(doc, self.cur_name, list(src.Views), []))
        self.cur_name = new
        self.update_sets(uiapp, [new])
        self.set_status(u"Created a copy '{}'.".format(new))

    def do_delete(self, uiapp):
        doc = uiapp.ActiveUIDocument.Document
        sets = self.get_sets(doc)
        name = self.cur_name
        if name not in sets:
            return
        t = Transaction(doc, "Delete Print Set")
        t.Start()
        try:
            pm, vss = self.setup_pm(doc)
            vss.CurrentViewSheetSet = sets[name]
            vss.Delete()
            t.Commit()
        except:
            t.RollBack()
            raise
        self.ord_del(doc, name)
        self.cur_name = u""
        self.update_sets(uiapp, [name])
        self.set_status(u"Deleted '{}'.".format(name))

    def do_select_in_revit(self, uiapp):
        uidoc = uiapp.ActiveUIDocument
        ids = List[ElementId]()
        for vid in self.sets.get(self.cur_name, []):
            ids.Add(ElementId(int(vid)))
        if ids.Count == 0:
            return
        uidoc.Selection.SetElementIds(ids)
        self.sync(uiapp, force=False)
        self.set_status(u"{} selected in Revit.".format(ids.Count))

    # ---------- print / PDF: checks, log, pause between groups ----------
    def print_check(self, uiapp):
        """Pre-print checks. Returns doc or raises a ValueError with an explanation (without calling the Revit API,
        which could break Revit)."""
        uidoc = uiapp.ActiveUIDocument
        if uidoc is None:
            raise ValueError(u"No project is open.")
        doc = uidoc.Document
        if self.doc_title is not None and doc.Title != self.doc_title:
            raise ValueError(u"The project changed after indexing. Click \"Refresh sheets\" and try again.")
        if doc.IsModifiable:
            raise ValueError(u"Revit is in edit mode right now (an open transaction). Finish the command and try again.")
        # Free RAM check: Pure Virtual Call when printing is often caused by a lack of memory.
        # Bluebeam + view regeneration need at least 4–8 GB of free RAM.
        try:
            import ctypes
            import ctypes.wintypes

            class _MEMSTATUS(ctypes.Structure):
                _fields_ = [
                    ("dwLength",                ctypes.wintypes.DWORD),
                    ("dwMemoryLoad",            ctypes.wintypes.DWORD),
                    ("ullTotalPhys",            ctypes.c_uint64),
                    ("ullAvailPhys",            ctypes.c_uint64),
                    ("ullTotalPageFile",        ctypes.c_uint64),
                    ("ullAvailPageFile",        ctypes.c_uint64),
                    ("ullTotalVirtual",         ctypes.c_uint64),
                    ("ullAvailVirtual",         ctypes.c_uint64),
                    ("ullAvailExtendedVirtual", ctypes.c_uint64),
                ]

            ms = _MEMSTATUS()
            ms.dwLength = ctypes.sizeof(ms)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(ms))
            free_gb = ms.ullAvailPhys / (1024.0 ** 3)
            tk_log(u"print: RAM free {:.1f} GB / load {}%".format(free_gb, ms.dwMemoryLoad))
            if free_gb < 4.0:
                raise ValueError(
                    u"Low free RAM: {:.1f} GB. "
                    u"Restart Revit and print again "
                    u"(at least 8 GB of free memory is recommended).".format(free_gb)
                )
            elif free_gb < 8.0:
                tk_log(u"print: WARNING free RAM {:.1f} GB — risk of a crash with large sets".format(free_gb))
        except ValueError:
            raise
        except Exception:
            pass  # if ctypes is unavailable — we skip the check
        return doc

    def print_views(self, doc, ids):
        """Only what can really be printed: not templates, not placeholder sheets, not vanished elements."""
        views, skipped = [], []
        for i in ids:
            v = doc.GetElement(ElementId(int(i)))
            ok = isinstance(v, View) and not v.IsTemplate and v.CanBePrinted
            if ok and isinstance(v, ViewSheet) and getattr(v, "IsPlaceholder", False):
                ok = False
            if ok:
                views.append(v)
            else:
                skipped.append(u"#{}".format(i) if v is None else self.label(v))
        return views, skipped

    def print_check_target(self, path):
        """A file that cannot be written must not reach the printer/export."""
        if len(path) > 240:
            raise ValueError(u"file path is too long ({} characters): {}".format(len(path), path))
        folder = os.path.dirname(path)
        if not os.path.isdir(folder):
            raise ValueError(u"the folder does not exist: " + folder)
        try:
            if os.path.exists(path):
                f = open(path, "ab")
                f.close()
            else:
                probe = path + u".tk_probe"
                f = open(probe, "wb")
                f.close()
                os.remove(probe)
        except Exception:
            raise ValueError(u"the file is open in another program or there are no write permissions: " + path)

    def do_print(self, uiapp):
        try:
            doc = self.print_check(uiapp)
        except ValueError as ex:
            return self.set_status(err_text(ex))
        s = self.get_sets(doc).get(self.cur_name)
        if s is None:
            return
        try:
            if s.Views.Size == 0:
                return self.set_status(u"Set '{}' is empty.".format(self.cur_name))
        except Exception:
            pass
        tk_log(u"print dialog: set '{}'".format(self.cur_name))
        t = Transaction(doc, "Select Print Set")
        t.Start()
        try:
            pm, vss = self.setup_pm(doc)
            vss.CurrentViewSheetSet = s
            t.Commit()
        except:
            t.RollBack()
            raise
        try:
            uiapp.PostCommand(RevitCommandId.LookupPostableCommandId(PostableCommand.Print))
        except Exception as ex:
            tk_log(u"print dialog: PostCommand failed: {}".format(ex))
            return self.set_status(u"Revit did not accept the Print command: {}".format(err_text(ex)))
        self.set_status(u"Opening Print with the set '{}'.".format(self.cur_name))

    def print_job(self, uiapp, groups, folder):
        """Prepares the job and runs the first group; the rest go as separate steps with a pause (print_step)."""
        try:
            self.prog_wait_collapse()
            doc = self.print_check(uiapp)
            combined = bool(self.chkCombined.IsChecked)
            cfg = self.exp_cfg()
            cad = cfg["fmt"] != u"pdf"
            if cad and not folder:
                raise ValueError(u"No export folder was chosen.")
            native = (not cad) and combined and bool(self.chkNative.IsChecked) and PDFExportOptions is not None and bool(folder)
            jobs, used, skipped = [], {}, []
            for title, ids in groups:
                views, bad = self.print_views(doc, ids)
                skipped.extend(bad)
                if not views:
                    continue
                nm = safe_name(title or self.cur_name)
                if combined or cad:
                    used[nm] = used.get(nm, 0) + 1
                    if used[nm] > 1:
                        nm = u"{} ({})".format(nm, used[nm])
                jobs.append((nm, views))
            if not jobs:
                raise ValueError(u"No sheets suitable for printing."
                                 + (u" Skipped: " + u"; ".join(skipped[:5]) if skipped else u""))
            mode = u"cad" if cad else ((u"native" if native else u"printer") if combined else u"separate")
            self.prog_total(sum(len(j[1]) for j in jobs), u"Export" if cad else u"Print")
            # mode="separate": sheets inside a group go quickly one after another (print_one),
            # the 1500 ms pause is set only BETWEEN groups (print_schedule).
            # We do NOT split into separate jobs — the PDF driver (PDF24/Bluebeam) assembles
            # the fast SubmitPrint calls of one group into a single document.
            st = {"mode": mode, "jobs": jobs, "i": 0, "ok": 0, "sheets": 0, "failed": [], "skipped": skipped,
                  "folder": folder, "prev": {}, "cfg": cfg, "used": set(), "opts": None}
            if cad:
                st["opts"] = self.make_cad_options(doc, cfg)
            tk_log(u"print: start mode={} groups={} sheets={} folder={} skipped={}".format(
                mode, len(jobs), sum(len(j[1]) for j in jobs), folder, len(skipped)))
            pm = doc.PrintManager
            if mode == u"printer":
                # Save the previous PrintManager values — restored after printing.
                for key in (u"CombinedFile", u"PrintToFile"):
                    try:
                        st["prev"][key] = getattr(pm, key)
                    except Exception:
                        pass
            elif mode == u"separate":
                t = Transaction(doc, "Print range")
                t.Start()
                try:
                    pm.PrintRange = PrintRange.Current
                    t.Commit()
                except:
                    t.RollBack()
                    raise
            self.print_step(uiapp, st)
        except Exception as ex:
            tk_log(u"print: aborted: {}\n{}".format(ex, traceback.format_exc()))
            self.set_status(u"Printing was not done: {}".format(err_text(ex)))
            self._print_busy = False
            self.prog_end()

    def _stop_print_timer(self):
        """Stops the DispatcherTimer between groups if it is still active (protection against a repeated call after an error)."""
        t = getattr(self, "_print_timer", None)
        if t is not None:
            try:
                t.Stop()
            except Exception:
                pass
            self._print_timer = None

    def print_schedule(self, st, delay_ms=1500):
        """Pause between groups: Revit has time to finish writing the previous file/job and free memory.
        1500 ms instead of 500 — PDF drivers (Bluebeam) need more time between jobs."""
        timer = DispatcherTimer()
        timer.Interval = TimeSpan.FromMilliseconds(delay_ms)

        def tick(s, e):
            timer.Stop()
            self.run(lambda ua: self.print_step(ua, st))
        timer.Tick += tick
        self._print_timer = timer
        timer.Start()

    def print_step(self, uiapp, st):
        doc = None
        try:
            doc = self.print_check(uiapp)
            n = len(st["jobs"])
            if st["i"] < n:
                nm, views = st["jobs"][st["i"]]
                tk_log(u"print [{}/{}] {} '{}': {}".format(
                    st["i"] + 1, n, st["mode"], nm, u", ".join(self.label(v) for v in views[:40])))
                self.set_status(u"Print {}/{}: {}…".format(st["i"] + 1, n, nm))
                try:
                    self.prog_update(st["sheets"], nm)
                    done = self.print_one(doc, st, nm, views)
                    st["ok"] += 1
                    st["sheets"] += done
                    self.prog_update(st["sheets"], nm)
                except Exception as ex:
                    tk_log(u"print FAIL '{}': {}\n{}".format(nm, ex, traceback.format_exc()))
                    st["failed"].append(u"{}: {}".format(nm, err_text(ex)))
                st["i"] += 1
                if st["i"] < n:
                    self.print_schedule(st)
                    return
            self.print_finish(doc, st)
        except Exception as ex:
            tk_log(u"print: interrupted: {}\n{}".format(ex, traceback.format_exc()))
            self._stop_print_timer()  # stop the timer — otherwise it will call print_step again on a broken state
            st["failed"].append(err_text(ex))
            try:
                if doc is not None:
                    self.print_finish(doc, st)
                    return
            except Exception:
                pass
            self.set_status(u"Printing interrupted: {}".format(err_text(ex)))
            self._print_busy = False
            self.prog_end()

    def print_one(self, doc, st, nm, views):
        """One group. Returns how many sheets were sent."""
        mode = st["mode"]
        if mode == u"cad":
            return self.export_one(doc, st, nm, views)
        if mode == u"native":
            self.print_check_target(os.path.join(st["folder"], nm + u".pdf"))
            ids = List[ElementId]()
            for v in views:
                ids.Add(v.Id)
            opts = PDFExportOptions()
            opts.Combine = True
            opts.FileName = nm
            doc.Export(st["folder"], ids, opts)
            return len(views)
        pm = doc.PrintManager
        if mode == u"printer":
            if st["folder"]:
                self.print_check_target(os.path.join(st["folder"], nm + u".pdf"))
            # Before every SubmitPrint we fully set the PrintManager settings.
            # Revit may reset CombinedFile/PrintRange after SubmitPrint — so they cannot
            # be set only once in print_job.
            t = Transaction(doc, "Print combined")
            t.Start()
            try:
                pm.PrintRange = PrintRange.Select
                vss = pm.ViewSheetSetting
                vss.CurrentViewSheetSet = vss.InSession
                vss.CurrentViewSheetSet.Views = self.to_viewset(views)
                pm.CombinedFile = True
                if st["folder"]:
                    try:
                        pm.PrintToFile = True
                        pm.PrintToFileName = os.path.join(st["folder"], nm + u".pdf")
                    except Exception:
                        pass
                t.Commit()
            except:
                t.RollBack()
                raise
            pm.SubmitPrint()
            return len(views)
        done = 0
        # mode="separate": all sheets of the group go quickly one after another — the PDF driver assembles them into one document.
        # The pause between GROUPS (not sheets) is set via print_schedule (1500 ms).
        for v in views:
            tk_log(u"  submit " + self.label(v))
            try:
                pm.SubmitPrint(v)
                done += 1
                self.prog_update(st["sheets"] + done)
            except Exception as ex:
                tk_log(u"  submit FAIL {}: {}".format(self.label(v), ex))
                st["failed"].append(u"{}: {}".format(self.label(v), err_text(ex)))
        return done

    def print_finish(self, doc, st):
        """Restores the print settings we changed and writes a summary."""
        self._stop_print_timer()  # stop the timer between steps if it is still ticking
        try:
            pm = doc.PrintManager
            if st["mode"] in (u"printer", u"separate"):
                t = Transaction(doc, "Print settings restore")
                t.Start()
                try:
                    if st["mode"] == u"printer":
                        for key, val in st["prev"].items():
                            try:
                                setattr(pm, key, val)
                            except Exception:
                                pass
                    else:
                        pm.PrintRange = PrintRange.Select
                    t.Commit()
                except:
                    t.RollBack()
                    raise
        except Exception as ex:
            tk_log(u"print: restore failed: {}".format(ex))
        total = len(st["jobs"])
        what = {u"native": u"PDF", u"printer": u"print (printer)", u"separate": u"print one by one",
                u"cad": st["cfg"]["fmt"].upper()}[st["mode"]]
        msg = u"{}: groups {} of {}, sheets {}.".format(what, st["ok"], total, st["sheets"])
        if st["skipped"]:
            msg += u" Skipped (not printable): {}.".format(len(st["skipped"]))
        if st["failed"]:
            msg += u" Error: {}".format(st["failed"][0])
        tk_log(u"print: done. " + msg)
        self.set_status(msg)
        self._print_busy = False
        self.prog_done(bool(st["failed"]))


# ======================================================================
#  TKX: Model audit · Command palette (Ctrl+K) · Action log with Undo ·
#       Error report · Settings export / import
#  Everything here works on top of PrintSetWindow (tkx_* methods). Audit only reads the model.
# ======================================================================
TKX_VERSION = u"2026-11-12 (workspaces, spotlight, revit links; audit: clashes, links, pins, sheets; report: pick each item; Deep audit: pick stages)"
TKX_FORMAT = u"UniversalToolkitSettings"
TKX_DIR = os.path.dirname(SET_PATH)
TKX_ACTIONS_LOG = os.path.join(TKX_DIR, "actions.log")
TKX_BACKUP_DIR = os.path.join(TKX_DIR, "backup")
TKX_AUDIT_PATH = os.path.join(TKX_DIR, "audit_last.json")     # the last audit result: kept until the next audit
TKX_BUDGET = 60.0          # seconds for the heaviest step of the QUICK audit (family instances); changed by the "Limit" chip on Home. Deep audit has no limit
TKX_LOG_SHOW = 8           # log rows on Home
TKX_LOG_KEEP = 300         # rows in actions.log
# what can be shared with colleagues (without window positions, paths, "last used")
TKX_PORTABLE = {u"browser_params": list, u"tile_params": dict, u"exp_setup": basestring,
                u"ann_side_gap_mm": (int, float), u"ann_bar_mode": None, u"palette_hotkey": bool,
                u"link_web_base": basestring, u"spot_params": list, u"ws_close_others": bool}

# (label, wrap in a TransactionGroup -> exactly one Undo step)
TKX_FN_LABELS = {
    u"do_create": (u"Create set", True), u"do_add": (u"Add to set", True),
    u"do_replace": (u"Replace set contents", True), u"do_remove": (u"Remove from set", True),
    u"do_rename": (u"Rename set", True), u"do_duplicate": (u"Duplicate set", True),
    u"do_delete": (u"Delete set", True), u"do_make_sets": (u"Create sets", True),
    u"do_apply_revisions": (u"Sheet revisions", True), u"do_nm_apply": (u"View naming", True),
    u"do_print": (u"Print / export", False), u"tkx_do_audit": (u"Model audit", False),
    u"tkx_do_audit_deep": (u"Deep model audit", False),
    u"tkx_report_to_model": (u"Audit report to model", True),
}
TKX_KEY_LABELS = {u"nudge": (u"Move marker", False), u"viewmaker": (u"View \u2192 Sheet", False),
                  u"print_dialog": (u"Print / export", False), u"nmapply": (u"View naming", True),
                  u"tkx_audit": (u"Model audit", False)}

_TKX_EN = u"qwertyuiop[]asdfghjkl;'zxcvbnm,."
_TKX_UK = u"\u0439\u0446\u0443\u043a\u0435\u043d\u0433\u0448\u0449\u0437\u0445\u0457\u0444\u0456\u0432\u0430\u043f\u0440\u043e\u043b\u0434\u0436\u0454\u044f\u0447\u0441\u043c\u0438\u0442\u044c\u0431\u044e"
_TKX_EN2UK = dict(zip(_TKX_EN, _TKX_UK))
_TKX_UK2EN = dict(zip(_TKX_UK, _TKX_EN))


# ---------------------------------------------------------------------------
#  Pure functions (no Revit): fuzzy search, settings merge, report, clipboard
# ---------------------------------------------------------------------------
def tkx_layouts(q):
    """The query + the same query typed in a "foreign" layout (e.g. "gryfn" typed in the wrong keyboard layout)."""
    q = (q or u"").lower()
    out = [q]
    a = u"".join(_TKX_EN2UK.get(c, c) for c in q)
    b = u"".join(_TKX_UK2EN.get(c, c) for c in q)
    for x in (a, b):
        if x and x not in out:
            out.append(x)
    return out


def tkx_score(tok, text):
    """None - no match; more is better. Substring > subsequence; word start - bonus."""
    t = text.lower()
    i = t.find(tok)
    if i >= 0:
        s = 1000.0 - i * 3 - len(t) * 0.2
        if i == 0 or t[i - 1] in u" -_/\u00B7:(":
            s += 200
        return s
    ti, prev, first, s = 0, -2, -1, 0.0
    for ch in tok:
        j = t.find(ch, ti)
        if j < 0:
            return None
        if first < 0:
            first = j
        s += 10
        if j == prev + 1:
            s += 15
        if j == 0 or t[j - 1] in u" -_/\u00B7:(":
            s += 12
        prev, ti = j, j + 1
    return s - first - len(t) * 0.1


def tkx_match(query, text):
    """All query words must match (in either layout). Returns the best score or None."""
    best = None
    for q in tkx_layouts(query):
        toks = [x for x in q.split() if x]
        if not toks:
            return 0.0
        total = 0.0
        for tk in toks:
            sc = tkx_score(tk, text)
            if sc is None:
                total = None
                break
            total += sc
        if total is not None and (best is None or total > best):
            best = total
    return best


def tkx_merge(a, b, union_lists=False):
    """Merge: dicts - by keys (the import wins); lists - union or replace; the rest - replace."""
    if isinstance(a, dict) and isinstance(b, dict):
        out = dict(a)
        for k, v in b.items():
            out[k] = tkx_merge(a[k], v, union_lists) if k in a else v
        return out
    if union_lists and isinstance(a, list) and isinstance(b, list):
        out = list(a)
        for x in b:
            if x not in out:
                out.append(x)
        return out
    return b


def tkx_clean_settings(raw):
    """From the imported block we keep only the allowed keys of the right type."""
    out, skipped = {}, []
    if not isinstance(raw, dict):
        return out, skipped
    for k, v in raw.items():
        typ = TKX_PORTABLE.get(k, False)
        if typ is False:
            skipped.append(k)
        elif typ is None or isinstance(v, typ):
            out[k] = v
        else:
            skipped.append(k)
    return out, skipped


def tkx_clip_set(text):
    """Text to the clipboard; WPF sometimes throws a COMException if the clipboard is busy - several attempts."""
    last = None
    for _ in range(6):
        try:
            Clipboard.SetText(text)
            return True
        except Exception as ex:
            last = ex
            time.sleep(0.05)
    tk_log(u"clipboard: {}".format(last))
    return False


def tkx_short(txt, n=60):
    txt = unicode(txt or u"").replace(u"\r", u" ").replace(u"\n", u" ")
    return txt if len(txt) <= n else txt[:n - 1] + u"\u2026"


def tkx_scrub(text):
    """Remove the Windows user name in paths from the report text."""
    try:
        home = os.path.expanduser(u"~")
        if home and len(home) > 3:
            text = text.replace(home, u"%USERPROFILE%")
    except Exception:
        pass
    return text


def tkx_env_lines(app=None):
    """Environment for the report: Revit, Python, OS, document, active view. Each item in its own try."""
    L = []
    try:
        a = (app or uiapp).Application
        L.append(u"Revit: {} (v{}, build {})".format(a.VersionName, a.VersionNumber, a.VersionBuild))
    except Exception as ex:
        L.append(u"Revit: ? ({})".format(ex))
    try:
        L.append(u"Python: " + unicode(sys.version).replace(u"\n", u" "))
    except Exception:
        pass
    try:
        L.append(u"Windows: {} | .NET {} | 64-bit process: {}".format(
            System.Environment.OSVersion.VersionString, System.Environment.Version, System.Environment.Is64BitProcess))
    except Exception:
        pass
    try:
        ad = (app or uiapp).ActiveUIDocument
        d = ad.Document if ad else None
        L.append(u"Document: " + (unicode(d.Title) if d is not None else u"(none)"))
        if d is not None:
            try:
                L.append(u"Workshared file / central: {}".format(u"yes" if d.IsWorkshared else u"no"))
            except Exception:
                pass
            try:
                v = d.ActiveView
                L.append(u"Active view: {} [{}]".format(v.Name, v.ViewType))
            except Exception:
                pass
            try:
                L.append(u"Elements selected: {}".format(ad.Selection.GetElementIds().Count))
            except Exception:
                pass
    except Exception as ex:
        L.append(u"Document: ? ({})".format(ex))
    return L


def tkx_log_tail(n=40):
    try:
        with open(TK_LOG, "rb") as f:
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - 16000))
            raw = f.read()
        return raw.decode("utf-8", "replace").splitlines()[-n:]
    except Exception:
        return []


def tkx_report_text(rec):
    """Error report to paste into a chat / email: time, environment, action, traceback, log tail."""
    L = [u"Universal Toolkit - error report", u"Build: " + TKX_VERSION,
         u"Time: " + time.strftime(u"%Y-%m-%d %H:%M:%S", time.localtime(rec.get(u"t0") or time.time()))]
    L.extend(rec.get(u"env") or tkx_env_lines())
    L.append(u"Action: " + (rec.get(u"label") or u"?"))
    L.append(u"Error: " + unicode(rec.get(u"error") or u""))
    L.append(u"")
    L.append(u"Traceback:")
    L.append(unicode(rec.get(u"tb") or u"(none)"))
    tail = tkx_log_tail()
    if tail:
        L.append(u"")
        L.append(u"toolkit_debug.log (last lines):")
        L.extend(tail)
    return tkx_scrub(u"\n".join(L))


def tkx_cap(lines, n=60):
    if len(lines) <= n:
        return lines
    return lines[:n] + [u"\u2026 and {} more".format(len(lines) - n)]


# ---------------------------------------------------------------------------
#  Model audit (read-only)
# ---------------------------------------------------------------------------
_TKX_VIEW_OK = set([u"FloorPlan", u"CeilingPlan", u"Elevation", u"Section", u"Detail", u"ThreeD",
                    u"DraftingView", u"AreaPlan", u"EngineeringPlan"])


def tkx_view_is_template(v):
    try:
        return bool(v.IsTemplate)
    except Exception:
        return False


def tkx_count_in_view(d, v):
    col = FilteredElementCollector(d, v.Id).WhereElementIsNotElementType()
    try:
        return int(col.GetElementCount())
    except Exception:
        return len(list(col.ToElementIds()))


class TkxAuditStop(BaseException):
    """Esc during the audit. This is a BaseException, so 'except Exception' in the steps does not swallow it."""
    pass


# (yellow from, red from). A red value = a full bar under the number on the tile.
TKX_LIMITS = {
    u"filesize": (650, 1000), u"imports": (1, 5), u"warnings": (100, 500), u"inplace": (1, 50),
    u"offsheet": (100, 500), u"groups": (10, 100), u"rooms": (1, 100), u"options": (1, 10),
    u"dups": (1, 50), u"filters": (1, 30), u"templates": (1, 20), u"patterns": (1, 50),
    u"clashes": (1, 50), u"links": (1, 3), u"unpinned": (1, 20), u"emptysheets": (1, 20),
    u"notemplate": (1, 100), u"unusedfam": (10, 100),
}
_TKX_OFFSHEET_OK = _TKX_VIEW_OK | set([u"Legend", u"Rendering"])


def tkx_level(key, val):
    """(level, bar fraction): ok / warn / bad / info."""
    lim = TKX_LIMITS.get(key)
    if lim is None or val is None:
        return u"info", 0.0
    lv = u"bad" if val >= lim[1] else (u"warn" if val >= lim[0] else u"ok")
    fr = min(1.0, float(val) / float(lim[1])) if lim[1] else 0.0
    return lv, fr


def tkx_num(n):
    return u"{:,}".format(int(n)).replace(u",", u"\u2009")


def tkx_fmt_eta(sec):
    sec = int(sec)
    if sec < 90:
        return u"{} s".format(sec)
    if sec < 5400:
        return u"{} min".format(int(round(sec / 60.0)))
    return u"{:.1f} h".format(sec / 3600.0)


class TkxProg(object):
    """Overall audit progress: steps with weights; cb(text, fraction 0..1, seconds_left or None)."""

    def __init__(self, stages, cb):
        self.cb = cb
        self.total = float(sum(w for k, w in stages)) or 1.0
        self.base = {}
        acc = 0.0
        for k, w in stages:
            self.base[k] = (acc, w)
            acc += w
        self.cur = None
        self.t_stage = time.time()
        self.t_last = 0.0

    def start(self, key, text):
        self.cur = key
        self.t_stage = time.time()
        self.tick(0.0, text, force=True)

    def tick(self, frac, text, eta=False, force=False):
        now = time.time()
        if not force and now - self.t_last < 0.12:
            return
        self.t_last = now
        b, w = self.base.get(self.cur, (0.0, 0.0))
        f = max(0.0, min(1.0, float(frac)))
        left = None
        el = now - self.t_stage
        if eta and f > 0.004 and el > 4.0:
            left = el * (1.0 - f) / f
        if self.cb:
            self.cb(text, (b + w * f) / self.total, left)


def tkx_warn_elems(d, w):
    parts = []
    try:
        for eid in list(w.GetFailingElements())[:2]:
            e = d.GetElement(eid)
            if e is None:
                continue
            cat, nm = u"", u""
            try:
                cat = unicode(e.Category.Name) if e.Category is not None else u""
            except Exception:
                pass
            try:
                nm = unicode(e.Name)
            except Exception:
                pass
            parts.append(u"{}: {} (id {})".format(cat or u"?", nm or u"?", id_value(eid)))
    except Exception:
        pass
    return u"  |  ".join(parts) or u"?"


def tkx_warn_ids(w, limit=6):
    """ElementIds (ints) of the elements of a Revit warning: what a click on the duplicates row shows."""
    out = []
    try:
        for x in list(w.GetFailingElements())[:limit]:
            out.append(id_value(x))
    except Exception:
        pass
    return out


TKX_CLASH_CAP = 20000       # elements of the first category checked per pair
TKX_CLASH_LIST = 1000       # clashes kept in the list (the counter keeps counting)


def tkx_clash_pairs():
    """(key, label, category A, category B, same category) for the clash step.
    Categories missing in this Revit version are skipped. The check is approximate: solids that intersect."""
    BIC = DB.BuiltInCategory
    spec = [
        (u"duct_pipe", u"Ducts \u00D7 Pipes", u"OST_DuctCurves", u"OST_PipeCurves"),
        (u"duct_tray", u"Ducts \u00D7 Cable trays", u"OST_DuctCurves", u"OST_CableTray"),
        (u"pipe_tray", u"Pipes \u00D7 Cable trays", u"OST_PipeCurves", u"OST_CableTray"),
        (u"duct_beam", u"Ducts \u00D7 Structural framing", u"OST_DuctCurves", u"OST_StructuralFraming"),
        (u"pipe_beam", u"Pipes \u00D7 Structural framing", u"OST_PipeCurves", u"OST_StructuralFraming"),
        (u"tray_beam", u"Cable trays \u00D7 Structural framing", u"OST_CableTray", u"OST_StructuralFraming"),
        (u"duct_col", u"Ducts \u00D7 Structural columns", u"OST_DuctCurves", u"OST_StructuralColumns"),
        (u"pipe_col", u"Pipes \u00D7 Structural columns", u"OST_PipeCurves", u"OST_StructuralColumns"),
        (u"wall_wall", u"Walls \u00D7 Walls (not joined)", u"OST_Walls", u"OST_Walls"),
        (u"floor_floor", u"Floors \u00D7 Floors (not joined)", u"OST_Floors", u"OST_Floors"),
        (u"col_col", u"Columns \u00D7 Columns", u"OST_StructuralColumns", u"OST_StructuralColumns"),
    ]
    out = []
    for key, label, a, b in spec:
        ca, cb = getattr(BIC, str(a), None), getattr(BIC, str(b), None)
        if ca is None or cb is None:
            continue
        out.append((key, label, ca, cb, a == b))
    return out


def tkx_el_label(e):
    """'Category: type name (id N)' for a clash line."""
    cat, nm = u"", u""
    try:
        cat = unicode(e.Category.Name) if e.Category is not None else u""
    except Exception:
        pass
    try:
        nm = unicode(e.Name)
    except Exception:
        pass
    return u"{}{} (id {})".format(cat + u": " if cat else u"", nm or u"?", id_value(e.Id))


class _TkxAuditCtx(object):
    """State shared by the audit stages. Each stage is a separate function: IronPython 2.7 cannot
    compile one function with ~150 locals plus nested closures (MutableTuple 'Item014' error)."""

    def __init__(self, d, res, P, deep, budget, confirm):
        self.d, self.res, self.P = d, res, P
        self.deep, self.budget, self.confirm = deep, budget, confirm
        self.clash_done = [False]
        self.views = []
        self.placed = set()
        self.used_pat = set()
        self.vstate = {u"rows": [], u"total": 0, u"skipped": 0, u"ran": False}

    def new_end(self):
        return (time.time() + float(self.budget)) if self.budget else None

    def over(self, t_end):
        return t_end is not None and time.time() > t_end

    def oops(self, what, ex):
        self.res[u"err"].append(u"{}: {}".format(what, err_text(ex)))
        tk_log(u"audit {}: {}\n{}".format(what, ex, traceback.format_exc()))

    def add_pat(self, x):
        try:
            iv = id_value(x)
            if iv != -1:
                self.used_pat.add(iv)
        except Exception:
            pass

    def fin_views(self):
        vstate, res = self.vstate, self.res
        if not vstate[u"ran"]:
            return
        rows = sorted(vstate[u"rows"], key=lambda r: -r[2])
        res[u"views"] = {u"items": [r[:4] for r in rows[:15]], u"ids": [r[4] for r in rows[:15]],
                         u"checked": len(rows), u"total": vstate[u"total"],
                         u"skipped": vstate[u"skipped"], u"deep": True, u"t": time.time()}



def _tkx_aud_filesize(ctx):
    d, res, P, deep, budget, confirm = ctx.d, ctx.res, ctx.P, ctx.deep, ctx.budget, ctx.confirm
    oops, add_pat, new_end, over = ctx.oops, ctx.add_pat, ctx.new_end, ctx.over
    views, placed, used_pat, vstate, clash_done = ctx.views, ctx.placed, ctx.used_pat, ctx.vstate, ctx.clash_done
    P.start(u"meta", u"file size")
    try:
        paths = []
        try:
            if d.PathName:
                paths.append(unicode(d.PathName))
        except Exception:
            pass
        try:
            if d.IsWorkshared:
                cp = d.GetWorksharingCentralModelPath()
                if cp is not None:
                    paths.append(unicode(DB.ModelPathUtils.ConvertModelPathToUserVisiblePath(cp)))
        except Exception:
            pass
        for p in paths:
            try:
                if os.path.isfile(p):
                    res[u"filesize"] = {u"mb": os.path.getsize(p) / 1048576.0, u"path": p}
                    break
            except Exception:
                pass
    except Exception as ex:
        oops(u"filesize", ex)


def _tkx_aud_warnings(ctx):
    d, res, P, deep, budget, confirm = ctx.d, ctx.res, ctx.P, ctx.deep, ctx.budget, ctx.confirm
    oops, add_pat, new_end, over = ctx.oops, ctx.add_pat, ctx.new_end, ctx.over
    views, placed, used_pat, vstate, clash_done = ctx.views, ctx.placed, ctx.used_pat, ctx.vstate, ctx.clash_done
    P.start(u"warn", u"Revit warnings")
    try:
        dup_def = None
        try:
            dup_def = DB.BuiltInFailures.OverlapFailures.DuplicateInstances
        except Exception:
            dup_def = None
        ws = list(d.GetWarnings())
        groups, dup_n, dup_items, dup_ids = {}, 0, [], []
        n = len(ws)
        for i, w in enumerate(ws):
            if i % 200 == 0:
                P.tick(float(i) / max(1, n), u"warnings {}/{}".format(i, n))
            try:
                txt = unicode(w.GetDescriptionText())
            except Exception:
                txt = u"?"
            groups[txt] = groups.get(txt, 0) + 1
            is_dup = False
            if dup_def is not None:
                try:
                    is_dup = (w.GetFailureDefinitionId().Guid == dup_def.Guid)
                except Exception:
                    is_dup = False
            if not is_dup:
                low = txt.lower()
                is_dup = (u"identical instances" in low) or (u"\u0456\u0434\u0435\u043d\u0442\u0438\u0447\u043d" in low) or (u"\u0438\u0434\u0435\u043d\u0442\u0438\u0447\u043d" in low)
            if is_dup:
                dup_n += 1
                if len(dup_items) < 300:
                    dup_items.append(tkx_warn_elems(d, w))
                    dup_ids.append(tkx_warn_ids(w))
        res[u"warnings"] = {u"n": len(ws), u"items": sorted(groups.items(), key=lambda kv: -kv[1])}
        res[u"dups"] = {u"n": dup_n, u"items": dup_items, u"ids": dup_ids}
    except Exception as ex:
        oops(u"warnings", ex)


def _tkx_aud_views(ctx):
    d, res, P, deep, budget, confirm = ctx.d, ctx.res, ctx.P, ctx.deep, ctx.budget, ctx.confirm
    oops, add_pat, new_end, over = ctx.oops, ctx.add_pat, ctx.new_end, ctx.over
    views, placed, used_pat, vstate, clash_done = ctx.views, ctx.placed, ctx.used_pat, ctx.vstate, ctx.clash_done
    P.start(u"views", u"views, templates, filters")
    try:
        views = ctx.views = list(FilteredElementCollector(d).OfClass(DB.View))
        sheet_has = set()                     # sheets that carry a viewport, legend or schedule
        for vp in FilteredElementCollector(d).OfClass(DB.Viewport):
            try:
                placed.add(id_value(vp.ViewId))
                sheet_has.add(id_value(vp.SheetId))
            except Exception:
                pass
        try:
            for ss in FilteredElementCollector(d).OfClass(DB.ScheduleSheetInstance):
                try:
                    sheet_has.add(id_value(ss.OwnerViewId))
                except Exception:
                    pass
        except Exception as ex_ss:
            tk_log(u"audit schedule instances: {}".format(ex_ss))
        empty_sh, n_sheets, notemp, n_placed = [], 0, [], 0
        filt = {}
        for f in FilteredElementCollector(d).OfClass(DB.ParameterFilterElement):
            filt[id_value(f.Id)] = unicode(f.Name)
        tmpl, used_f, used_t = {}, set(), set()
        off, by, cand_total = [], {}, 0
        n = len(views)
        for i, v in enumerate(views):
            if i % 400 == 0:
                P.tick(float(i) / max(1, n), u"views {}/{}".format(i, n))
            if tkx_view_is_template(v):
                tmpl[id_value(v.Id)] = unicode(v.Name)
            else:
                try:
                    iv = id_value(v.ViewTemplateId)
                    if iv != -1:
                        used_t.add(iv)
                except Exception:
                    pass
                try:
                    vt = unicode(v.ViewType)
                    if vt == u"Legend" and not res.get(u"legend0"):
                        res[u"legend0"] = unicode(v.Name)
                    if vt == u"DrawingSheet":
                        n_sheets += 1
                        try:
                            ph = bool(v.IsPlaceholder)
                        except Exception:
                            ph = False
                        if not ph and id_value(v.Id) not in sheet_has:
                            empty_sh.append((u"{}  {}".format(unicode(v.SheetNumber), unicode(v.Name)), id_value(v.Id)))
                    elif vt in _TKX_VIEW_OK and id_value(v.Id) in placed:
                        n_placed += 1
                        try:
                            if id_value(v.ViewTemplateId) == -1:
                                notemp.append((unicode(v.Name), vt, id_value(v.Id)))
                        except Exception:
                            pass
                    if vt in _TKX_OFFSHEET_OK:
                        cand_total += 1
                        if id_value(v.Id) not in placed:
                            off.append((unicode(v.Name), vt, id_value(v.Id)))
                            by[vt] = by.get(vt, 0) + 1
                except Exception:
                    pass
            try:
                for fid in v.GetFilters():
                    used_f.add(id_value(fid))
                    try:
                        ov = v.GetFilterOverrides(fid)
                        add_pat(ov.ProjectionLinePatternId)
                        add_pat(ov.CutLinePatternId)
                    except Exception:
                        pass
            except Exception:
                pass
        uf = sorted(nm for i, nm in filt.items() if i not in used_f)
        ut = sorted(nm for i, nm in tmpl.items() if i not in used_t)
        res[u"filters"] = {u"n": len(uf), u"total": len(filt), u"items": uf}
        res[u"templates"] = {u"n": len(ut), u"total": len(tmpl), u"items": ut}
        off_s = sorted(off, key=lambda r: (r[1], r[0].lower()))
        res[u"offsheet"] = {u"n": len(off), u"total": cand_total,
                            u"items": [(r[0], r[1]) for r in off_s], u"ids": [r[2] for r in off_s],
                            u"by": sorted(by.items(), key=lambda kv: -kv[1])}
        es_s = sorted(empty_sh, key=lambda r: r[0].lower())
        res[u"emptysheets"] = {u"n": len(es_s), u"total": n_sheets, u"items": [r[0] for r in es_s],
                               u"ids": [r[1] for r in es_s]}
        nt_s = sorted(notemp, key=lambda r: (r[1], r[0].lower()))
        res[u"notemplate"] = {u"n": len(nt_s), u"total": n_placed,
                              u"items": [u"{}  [{}]".format(r[0], r[1]) for r in nt_s], u"ids": [r[2] for r in nt_s]}
    except Exception as ex:
        oops(u"views/filters", ex)


def _tkx_aud_families(ctx):
    d, res, P, deep, budget, confirm = ctx.d, ctx.res, ctx.P, ctx.deep, ctx.budget, ctx.confirm
    oops, add_pat, new_end, over = ctx.oops, ctx.add_pat, ctx.new_end, ctx.over
    views, placed, used_pat, vstate, clash_done = ctx.views, ctx.placed, ctx.used_pat, ctx.vstate, ctx.clash_done
    P.start(u"fam", u"families")
    try:
        fams = {}
        skip_cat = set()                  # families that are used without being placed as instances (profiles, balusters...)
        for _cn in (u"OST_ProfileFamilies", u"OST_StairsRailingBaluster", u"OST_StairsRailingSupport"):
            try:
                _bc = getattr(DB.BuiltInCategory, str(_cn), None)
                if _bc is not None:
                    skip_cat.add(int(_bc))
            except Exception:
                pass
        for f in FilteredElementCollector(d).OfClass(DB.Family):
            try:
                cn = unicode(f.FamilyCategory.Name) if f.FamilyCategory is not None else u""
            except Exception:
                cn = u""
            inpl = False
            try:
                inpl = bool(f.IsInPlace)
            except Exception:
                pass
            ismodel = False
            try:
                ismodel = (unicode(f.FamilyCategory.CategoryType) == u"Model" and
                           id_value(f.FamilyCategory.Id) not in skip_cat)
            except Exception:
                pass
            fams[id_value(f.Id)] = (unicode(f.Name), cn, inpl, ismodel)
        total_fi = 0
        try:
            total_fi = int(FilteredElementCollector(d).OfClass(DB.FamilyInstance).GetElementCount())
        except Exception:
            total_fi = 0
        counts, fam_of, seen, full = {}, {}, 0, True
        t_end = new_end()
        for fi in FilteredElementCollector(d).OfClass(DB.FamilyInstance):
            seen += 1
            if seen % 400 == 0:
                if over(t_end):
                    full = False
                    break
                P.tick(float(seen) / total_fi if total_fi else 0.0,
                       u"family instances {}/{}".format(seen, total_fi or u"?"))
            try:
                tid = id_value(fi.GetTypeId())
                if tid not in fam_of:
                    sym = d.GetElement(fi.GetTypeId())
                    fam_of[tid] = id_value(sym.Family.Id) if sym is not None else -1
                fk = fam_of[tid]
                counts[fk] = counts.get(fk, 0) + 1
            except Exception:
                pass
        if not full:
            res[u"notes"].append(u"Family instances: checked {} of {} (time limit {:.0f} s; Deep audit - no limit)".format(
                seen, total_fi or u"?", float(budget or 0)))
        rows = []
        for k, nm in fams.items():
            n_ = counts.get(k, 0)
            if n_:
                rows.append((nm[0], nm[1], n_, nm[2], k))
        rows.sort(key=lambda r: -r[2])
        res[u"families"] = {u"items": [(r[0], r[1], r[2]) for r in rows[:15]], u"seen": seen,
                            u"ids": [r[4] for r in rows[:15]]}
        ip = [(nm[0], nm[1], counts.get(k, 0), k) for k, nm in fams.items() if nm[2]]
        ip.sort(key=lambda r: (-r[2], r[0]))
        res[u"inplace"] = {u"n": len(ip), u"items": [r[:3] for r in ip], u"ids": [r[3] for r in ip]}
        if full:
            uf_rows = sorted([(nm[1], nm[0], k) for k, nm in fams.items() if nm[3] and not nm[2] and not counts.get(k, 0)])
            res[u"unusedfam"] = {u"ran": True, u"n": len(uf_rows),
                                 u"total": sum(1 for nm in fams.values() if nm[3] and not nm[2]),
                                 u"items": [u"{}  [{}]".format(r[1], r[0] or u"?") for r in uf_rows],
                                 u"ids": [r[2] for r in uf_rows], u"names": [r[1] for r in uf_rows]}
        else:
            res[u"notes"].append(u"Unused families: not calculated (family instances were counted only partly; Deep audit has no limit)")
    except Exception as ex:
        oops(u"families", ex)


def _tkx_aud_imports(ctx):
    d, res, P, deep, budget, confirm = ctx.d, ctx.res, ctx.P, ctx.deep, ctx.budget, ctx.confirm
    oops, add_pat, new_end, over = ctx.oops, ctx.add_pat, ctx.new_end, ctx.over
    views, placed, used_pat, vstate, clash_done = ctx.views, ctx.placed, ctx.used_pat, ctx.vstate, ctx.clash_done
    P.start(u"imp", u"CAD imports")
    try:
        imp, lnk = [], 0
        for i in FilteredElementCollector(d).OfClass(DB.ImportInstance):
            try:
                if i.IsLinked:
                    lnk += 1
                    continue
            except Exception:
                pass
            nm, vs = u"", False
            try:
                nm = unicode(i.Category.Name) if i.Category is not None else u""
            except Exception:
                pass
            try:
                vs = bool(i.ViewSpecific)
            except Exception:
                pass
            imp.append((nm or u"(unnamed)", vs, id_value(i.Id)))
        imp_s = sorted(imp)
        res[u"imports"] = {u"n": len(imp), u"linked": lnk, u"items": [(r[0], r[1]) for r in imp_s],
                           u"ids": [r[2] for r in imp_s]}
    except Exception as ex:
        oops(u"imports", ex)


def _tkx_aud_patterns(ctx):
    d, res, P, deep, budget, confirm = ctx.d, ctx.res, ctx.P, ctx.deep, ctx.budget, ctx.confirm
    oops, add_pat, new_end, over = ctx.oops, ctx.add_pat, ctx.new_end, ctx.over
    views, placed, used_pat, vstate, clash_done = ctx.views, ctx.placed, ctx.used_pat, ctx.vstate, ctx.clash_done
    P.start(u"pat", u"line patterns")
    try:
        pats = {}
        for lp in FilteredElementCollector(d).OfClass(DB.LinePatternElement):
            pats[id_value(lp.Id)] = unicode(lp.Name)
        cats, top = [], []
        for c in d.Settings.Categories:
            cats.append(c)
            top.append(c)
            try:
                for sc in c.SubCategories:
                    cats.append(sc)
            except Exception:
                pass
        for c in cats:
            for g in (DB.GraphicsStyleType.Projection, DB.GraphicsStyleType.Cut):
                try:
                    add_pat(c.GetLinePatternId(g))
                except Exception:
                    pass
        cat_ids = []
        for c in top:
            try:
                if unicode(c.CategoryType) in (u"Model", u"Annotation"):
                    cat_ids.append(c.Id)
            except Exception:
                pass
        ordered = [v for v in views if tkx_view_is_template(v)]
        if deep:
            ordered += [v for v in views if not tkx_view_is_template(v)]
        n = len(ordered)
        for idx, v in enumerate(ordered):
            if idx % 20 == 0:
                P.tick(float(idx) / max(1, n), u"line patterns: view {}/{}".format(idx, n))
            try:
                if not v.AreGraphicsOverridesAllowed():
                    continue
            except Exception:
                continue
            for cid in cat_ids:
                try:
                    ov = v.GetCategoryOverrides(cid)
                    add_pat(ov.ProjectionLinePatternId)
                    add_pat(ov.CutLinePatternId)
                except Exception:
                    pass
        if not deep:
            res[u"notes"].append(u"Line patterns: category styles, filters and view templates are taken into account (all views - in the Deep audit)")
        un = sorted(nm for i, nm in pats.items() if i not in used_pat)
        res[u"patterns"] = {u"n": len(un), u"total": len(pats), u"items": un}
    except Exception as ex:
        oops(u"line patterns", ex)


def _tkx_aud_groups(ctx):
    d, res, P, deep, budget, confirm = ctx.d, ctx.res, ctx.P, ctx.deep, ctx.budget, ctx.confirm
    oops, add_pat, new_end, over = ctx.oops, ctx.add_pat, ctx.new_end, ctx.over
    views, placed, used_pat, vstate, clash_done = ctx.views, ctx.placed, ctx.used_pat, ctx.vstate, ctx.clash_done
    P.start(u"misc", u"groups, rooms, options")
    try:
        gts = {}
        ig = int(DB.BuiltInCategory.OST_IOSModelGroups)
        for gt in FilteredElementCollector(d).OfClass(DB.GroupType):
            try:
                if gt.Category is not None and id_value(gt.Category.Id) == ig:
                    gts[id_value(gt.Id)] = [unicode(gt.Name), 0]
            except Exception:
                pass
        for g in FilteredElementCollector(d).OfClass(DB.Group):
            try:
                tid = id_value(g.GetTypeId())
                if tid in gts:
                    gts[tid][1] += 1
            except Exception:
                pass
        gl3 = sorted([(v[0], v[1], k) for k, v in gts.items()], key=lambda r: (-r[1], r[0]))
        gl = [(r[0], r[1]) for r in gl3]
        res[u"groups"] = {u"n": len(gl), u"inst": sum(r[1] for r in gl), u"items": gl,
                          u"ids": [r[2] for r in gl3]}
    except Exception as ex:
        oops(u"groups", ex)


def _tkx_aud_rooms(ctx):
    d, res, P, deep, budget, confirm = ctx.d, ctx.res, ctx.P, ctx.deep, ctx.budget, ctx.confirm
    oops, add_pat, new_end, over = ctx.oops, ctx.add_pat, ctx.new_end, ctx.over
    views, placed, used_pat, vstate, clash_done = ctx.views, ctx.placed, ctx.used_pat, ctx.vstate, ctx.clash_done
    P.tick(0.4, u"rooms", force=True)
    try:
        unpl, unenc, total = [], 0, 0
        for r in FilteredElementCollector(d).OfCategory(DB.BuiltInCategory.OST_Rooms).WhereElementIsNotElementType():
            total += 1
            try:
                if r.Location is None:
                    nm, num, lvl = u"", u"", u""
                    try:
                        nm = unicode(r.get_Parameter(DB.BuiltInParameter.ROOM_NAME).AsString() or u"")
                    except Exception:
                        pass
                    try:
                        num = unicode(r.Number or u"")
                    except Exception:
                        pass
                    try:
                        lvl = unicode(r.Level.Name) if r.Level is not None else u""
                    except Exception:
                        pass
                    unpl.append((u"{}  {}  [{}]".format(num, nm, lvl).strip(), id_value(r.Id)))
                elif r.Area <= 0:
                    unenc += 1
            except Exception:
                pass
        unpl.sort()
        res[u"rooms"] = {u"n": len(unpl), u"unenclosed": unenc, u"total": total,
                         u"items": [r[0] for r in unpl], u"ids": [r[1] for r in unpl]}
    except Exception as ex:
        oops(u"rooms", ex)


def _tkx_aud_options(ctx):
    d, res, P, deep, budget, confirm = ctx.d, ctx.res, ctx.P, ctx.deep, ctx.budget, ctx.confirm
    oops, add_pat, new_end, over = ctx.oops, ctx.add_pat, ctx.new_end, ctx.over
    views, placed, used_pat, vstate, clash_done = ctx.views, ctx.placed, ctx.used_pat, ctx.vstate, ctx.clash_done
    P.tick(0.8, u"design options", force=True)
    try:
        ol = []
        for o in FilteredElementCollector(d).OfClass(DB.DesignOption):
            sn = u""
            try:
                p = o.get_Parameter(DB.BuiltInParameter.OPTION_SET_ID)
                se = d.GetElement(p.AsElementId()) if p is not None else None
                sn = unicode(se.Name) if se is not None else u""
            except Exception:
                pass
            pr = False
            try:
                pr = bool(o.IsPrimary)
            except Exception:
                pass
            ol.append(u"{}: {}{}".format(sn or u"?", unicode(o.Name), u"  (main)" if pr else u""))
        res[u"options"] = {u"n": len(ol), u"items": sorted(ol)}
    except Exception as ex:
        oops(u"design options", ex)


def _tkx_aud_links(ctx):
    d, res, P, deep, budget, confirm = ctx.d, ctx.res, ctx.P, ctx.deep, ctx.budget, ctx.confirm
    oops, add_pat, new_end, over = ctx.oops, ctx.add_pat, ctx.new_end, ctx.over
    views, placed, used_pat, vstate, clash_done = ctx.views, ctx.placed, ctx.used_pat, ctx.vstate, ctx.clash_done
    P.tick(0.9, u"links, pinned levels and grids", force=True)
    try:
        by_type = {}
        for li in FilteredElementCollector(d).OfClass(DB.RevitLinkInstance):
            try:
                by_type.setdefault(id_value(li.GetTypeId()), []).append(li)
            except Exception:
                pass
        lrows, total_l = [], 0
        for lt in FilteredElementCollector(d).OfClass(DB.RevitLinkType):
            try:
                if lt.IsNestedLink:
                    continue
            except Exception:
                pass
            total_l += 1
            nm = unicode(lt.Name)
            try:
                st_ = unicode(lt.GetLinkedFileStatus())
            except Exception:
                st_ = u"?"
            insts = by_type.get(id_value(lt.Id), [])
            n_unp = 0
            for li in insts:
                try:
                    if not li.Pinned:
                        n_unp += 1
                except Exception:
                    pass
            flags = []
            bad = False
            if st_ == u"LocallyUnloaded":
                flags.append(u"unloaded for you")
            elif st_ != u"Loaded":
                flags.append(st_)
                bad = True
            elif not insts:
                flags.append(u"not placed")
                bad = True
            if n_unp:
                flags.append(u"{} not pinned".format(n_unp))
                bad = True
            lrows.append((0 if bad else 1, nm.lower(), nm, u"{}  \u2014  {}".format(nm, u", ".join(flags) if flags else u"ok"),
                          [id_value(li.Id) for li in insts][:50]))
        lrows.sort()
        res[u"links"] = {u"n": sum(1 for r in lrows if r[0] == 0), u"total": total_l,
                         u"items": [r[3] for r in lrows], u"ids": [r[4] for r in lrows], u"names": [r[2] for r in lrows]}
    except Exception as ex:
        oops(u"links", ex)


def _tkx_aud_pinned(ctx):
    d, res, P, deep, budget, confirm = ctx.d, ctx.res, ctx.P, ctx.deep, ctx.budget, ctx.confirm
    oops, add_pat, new_end, over = ctx.oops, ctx.add_pat, ctx.new_end, ctx.over
    views, placed, used_pat, vstate, clash_done = ctx.views, ctx.placed, ctx.used_pat, ctx.vstate, ctx.clash_done
    try:
        up_i, tot_p = [], 0
        for cls, lab in ((DB.Level, u"Level"), (DB.Grid, u"Grid")):
            for e in FilteredElementCollector(d).OfClass(cls):
                tot_p += 1
                try:
                    if not e.Pinned:
                        up_i.append((lab, unicode(e.Name), id_value(e.Id)))
                except Exception:
                    pass
        up_i.sort(key=lambda r: (r[0], r[1].lower()))
        res[u"unpinned"] = {u"n": len(up_i), u"total": tot_p, u"items": [u"{}: {}".format(r[0], r[1]) for r in up_i],
                            u"ids": [r[2] for r in up_i]}
    except Exception as ex:
        oops(u"pinned", ex)


def _tkx_aud_clashes(ctx):
    d, res, P, deep, budget, confirm = ctx.d, ctx.res, ctx.P, ctx.deep, ctx.budget, ctx.confirm
    oops, add_pat, new_end, over = ctx.oops, ctx.add_pat, ctx.new_end, ctx.over
    views, placed, used_pat, vstate, clash_done = ctx.views, ctx.placed, ctx.used_pat, ctx.vstate, ctx.clash_done
    P.start(u"clash", u"clashes")
    cl = res[u"clashes"]
    try:
        def _cnt(col):
            try:
                return int(col.GetElementCount())
            except Exception:
                return len(list(col.ToElementIds()))
        plan, total_el = [], 0
        for pr in tkx_clash_pairs():
            try:
                na = _cnt(FilteredElementCollector(d).OfCategory(pr[2]).WhereElementIsNotElementType())
                nb = na if pr[4] else _cnt(FilteredElementCollector(d).OfCategory(pr[3]).WhereElementIsNotElementType())
            except Exception:
                continue
            if na and nb:
                plan.append((pr, min(na, TKX_CLASH_CAP)))
                total_el += min(na, TKX_CLASH_CAP)
        cl[u"ran"] = True
        cl[u"total"] = total_el
        done_el, per, seen_pairs = 0, {}, set()
        for pr, na in plan:
            label, same = pr[1], pr[4]
            k_a = 0
            for a in FilteredElementCollector(d).OfCategory(pr[2]).WhereElementIsNotElementType():
                k_a += 1
                if k_a > TKX_CLASH_CAP:
                    break
                done_el += 1
                if done_el % 10 == 0:
                    P.tick(float(done_el) / max(1, total_el), u"clashes: {}  {}/{}".format(label, done_el, total_el), eta=True)
                try:
                    bb = a.get_BoundingBox(None)
                    if bb is None:
                        continue
                    col = (FilteredElementCollector(d).OfCategory(pr[3]).WhereElementIsNotElementType()
                           .WherePasses(DB.BoundingBoxIntersectsFilter(DB.Outline(bb.Min, bb.Max)))
                           .WherePasses(DB.ElementIntersectsElementFilter(a)))
                    for b in col:
                        ia, ib = id_value(a.Id), id_value(b.Id)
                        if ia == ib:
                            continue
                        if same:
                            kk = (min(ia, ib), max(ia, ib))
                            if kk in seen_pairs:
                                continue
                            seen_pairs.add(kk)
                            try:
                                if pr[0] in (u"wall_wall", u"floor_floor") and DB.JoinGeometryUtils.AreElementsJoined(d, a, b):
                                    continue
                            except Exception:
                                pass
                        cl[u"n"] += 1
                        per[label] = per.get(label, 0) + 1
                        if len(cl[u"items"]) < TKX_CLASH_LIST:
                            cl[u"items"].append(u"{}  \u00D7  {}".format(tkx_el_label(a), tkx_el_label(b)))
                            cl[u"ids"].append([ia, ib])
                        cl[u"pairs"] = sorted(per.items(), key=lambda kv: -kv[1])
                except TkxAuditStop:
                    raise
                except Exception:
                    pass
        clash_done[0] = True
        if cl[u"n"] > len(cl[u"items"]):
            res[u"notes"].append(u"Clashes: {} found, the list keeps the first {}".format(cl[u"n"], TKX_CLASH_LIST))
        res[u"notes"].append(u"Clashes: approximate (intersecting solids in this model; Revit links are not checked)")
    except Exception as ex:
        oops(u"clashes", ex)


def _tkx_aud_heavy(ctx):
    d, res, P, deep, budget, confirm = ctx.d, ctx.res, ctx.P, ctx.deep, ctx.budget, ctx.confirm
    oops, add_pat, new_end, over = ctx.oops, ctx.add_pat, ctx.new_end, ctx.over
    views, placed, used_pat, vstate, clash_done = ctx.views, ctx.placed, ctx.used_pat, ctx.vstate, ctx.clash_done
    P.start(u"heavy", u"heaviest views")
    try:
        cand, skipped = [], 0
        for v in views:
            if tkx_view_is_template(v):
                continue
            try:
                if unicode(v.ViewType) not in _TKX_VIEW_OK:
                    continue
            except Exception:
                continue
            try:
                if id_value(v.GetPrimaryViewId()) != -1:      # dependent view: the same elements as in the primary one
                    skipped += 1
                    continue
            except Exception:
                pass
            cand.append(v)

        def prio(v):
            try:
                on = id_value(v.Id) in placed
            except Exception:
                on = False
            try:
                td = unicode(v.ViewType) == u"ThreeD"
            except Exception:
                td = False
            return (0 if on else 1, 0 if td else 1)
        cand.sort(key=prio)                                    # first views on sheets, then 3D
        go = True
        if confirm is not None and len(cand) >= 300:
            go = bool(confirm(len(cand)))
        if not go:
            res[u"notes"].append(u"Heaviest views skipped (confirmation cancelled)")
        else:
            vstate[u"ran"] = True
            vstate[u"total"] = len(cand)
            vstate[u"skipped"] = skipped
            n = len(cand)
            for idx, v in enumerate(cand):
                P.tick(float(idx) / max(1, n), u"heaviest views {}/{}".format(idx, n), eta=True)
                try:
                    vstate[u"rows"].append((unicode(v.Name), unicode(v.ViewType), tkx_count_in_view(d, v),
                                            id_value(v.Id) in placed, id_value(v.Id)))
                except Exception:
                    pass
            ctx.fin_views()
    except Exception as ex:
        oops(u"views heavy", ex)


# Audit stages, in run order: (key, progress key, caption, hint, cost 0 fast / 1 medium / 2 slow, Deep audit only)
TKX_DEEP_STAGES = [
    (u"filesize", u"meta", u"File size", u"size of the file on disk", 0, False),
    (u"warnings", u"warn", u"Revit warnings + duplicates", u"all warnings, identical instances", 1, False),
    (u"views", u"views", u"Views, templates, filters, sheets", u"not on sheets, unused filters / templates, empty sheets", 1, False),
    (u"families", u"fam", u"Families", u"in-place, largest, unused; no time limit in Deep", 2, False),
    (u"imports", u"imp", u"CAD imports", u"", 0, False),
    (u"patterns", u"pat", u"Unused line patterns", u"all views, not only templates; needs Views", 2, False),
    (u"groups", u"misc", u"Model groups", u"", 0, False),
    (u"rooms", u"misc", u"Rooms", u"not placed / not enclosed", 0, False),
    (u"options", u"misc", u"Design options", u"", 0, False),
    (u"links", u"misc", u"Revit links", u"status, placement, pins", 0, False),
    (u"pinned", u"misc", u"Pinned levels and grids", u"", 0, False),
    (u"clashes", u"clash", u"Clashes", u"Deep only: geometric intersections, Esc cancels", 2, True),
    (u"heavy", u"heavy", u"Heaviest views", u"Deep only: elements in every view; needs Views", 2, True),
]
# which keys of the audit result each stage writes (to keep them from the previous audit when the stage is skipped)
TKX_STAGE_KEYS = {
    u"filesize": (u"filesize",), u"warnings": (u"warnings", u"dups"),
    u"views": (u"filters", u"templates", u"offsheet", u"emptysheets", u"notemplate", u"legend0"),
    u"families": (u"families", u"inplace", u"unusedfam"), u"imports": (u"imports",), u"patterns": (u"patterns",),
    u"groups": (u"groups",), u"rooms": (u"rooms",), u"options": (u"options",), u"links": (u"links",),
    u"pinned": (u"unpinned",), u"clashes": (u"clashes",), u"heavy": (u"views",),
}
# audit item (tile / report row) -> the stage that collects it
TKX_ITEM_STAGE = {
    u"filesize": u"filesize", u"warnings": u"warnings", u"dups": u"warnings",
    u"offsheet": u"views", u"filters": u"views", u"templates": u"views", u"emptysheets": u"views", u"notemplate": u"views",
    u"inplace": u"families", u"families": u"families", u"unusedfam": u"families", u"imports": u"imports",
    u"patterns": u"patterns", u"groups": u"groups", u"rooms": u"rooms", u"options": u"options", u"links": u"links",
    u"unpinned": u"pinned", u"clashes": u"clashes", u"views": u"heavy",
}
_TKX_AUD_FN = {u"filesize": _tkx_aud_filesize, u"warnings": _tkx_aud_warnings, u"views": _tkx_aud_views,
               u"families": _tkx_aud_families, u"imports": _tkx_aud_imports, u"patterns": _tkx_aud_patterns,
               u"groups": _tkx_aud_groups, u"rooms": _tkx_aud_rooms, u"options": _tkx_aud_options,
               u"links": _tkx_aud_links, u"pinned": _tkx_aud_pinned, u"clashes": _tkx_aud_clashes,
               u"heavy": _tkx_aud_heavy}


def tkx_audit_collect(d, step=None, deep=False, budget=None, confirm=None, only=None):
    """Collects model health metrics. The model is not changed.
    deep=False: quick audit (without iterating over views). deep=True: everything, no time limit, Esc - cancel.
    step(text, fraction, seconds_left) - update the progress (may raise TkxAuditStop).
    budget - seconds for the heaviest step of the quick audit (None = no limit).
    only - set of stage keys (TKX_DEEP_STAGES) to run; None = all. Patterns / heaviest views pull in the Views stage."""
    res = {u"doc": unicode(d.Title), u"t": time.time(), u"deep": bool(deep), u"notes": [], u"err": [],
           u"cancelled": False,
           u"filesize": {u"mb": None, u"path": u""},
           u"warnings": {u"n": 0, u"items": []}, u"dups": {u"n": 0, u"items": []},
           u"filters": {u"n": 0, u"total": 0, u"items": []}, u"templates": {u"n": 0, u"total": 0, u"items": []},
           u"offsheet": {u"n": 0, u"total": 0, u"items": [], u"by": []},
           u"inplace": {u"n": 0, u"items": []}, u"families": {u"items": [], u"seen": 0},
           u"imports": {u"n": 0, u"linked": 0, u"items": []}, u"patterns": {u"n": 0, u"total": 0, u"items": []},
           u"groups": {u"n": 0, u"inst": 0, u"items": []}, u"rooms": {u"n": 0, u"unenclosed": 0, u"total": 0, u"items": []},
           u"options": {u"n": 0, u"items": []},
           u"clashes": {u"ran": False, u"n": 0, u"items": [], u"ids": [], u"pairs": [], u"total": 0, u"partial": False},
           u"links": {u"n": 0, u"total": 0, u"items": [], u"ids": [], u"names": []},
           u"unpinned": {u"n": 0, u"total": 0, u"items": [], u"ids": []},
           u"emptysheets": {u"n": 0, u"total": 0, u"items": [], u"ids": []},
           u"notemplate": {u"n": 0, u"total": 0, u"items": [], u"ids": []},
           u"unusedfam": {u"ran": False, u"n": 0, u"total": 0, u"items": [], u"ids": [], u"names": []},
           u"views": {u"items": [], u"checked": 0, u"total": 0, u"skipped": 0, u"deep": False}}
    t_start = time.time()
    only = None if only is None else set(only)
    if only is not None and (u"patterns" in only or u"heavy" in only):
        only.add(u"views")
    run = []
    for key, pk, cap, hint, cost, deep_only in TKX_DEEP_STAGES:
        if deep_only and not deep:
            continue
        if only is not None and key not in only:
            continue
        run.append((key, pk))
    weight = {u"meta": 0.2, u"warn": 2.0, u"views": 2.0, u"fam": 8.0, u"imp": 0.4,
              u"pat": 4.0 if deep else 2.0, u"misc": 1.0, u"clash": 12.0, u"heavy": 20.0}
    stages = []
    for key, pk in run:
        if pk not in [x[0] for x in stages]:
            stages.append((pk, weight[pk]))
    ran_keys = [x[0] for x in run]
    res[u"skipped"] = [r[0] for r in TKX_DEEP_STAGES if r[0] not in ran_keys and (deep or not r[5])]
    P = TkxProg(stages, step)
    ctx = _TkxAuditCtx(d, res, P, deep, budget, confirm)

    try:
        for key, pk in run:
            P.cur = pk
            _TKX_AUD_FN[key](ctx)
    except TkxAuditStop:
        res[u"cancelled"] = True
        ctx.fin_views()
        try:
            if res[u"clashes"].get(u"ran") and not ctx.clash_done[0]:
                res[u"clashes"][u"partial"] = True
        except Exception:
            pass
        res[u"notes"].append(u"Audit cancelled (Esc): showing what could be collected")
    res[u"dur"] = time.time() - t_start
    return res


def tkx_audit_save(res):
    """The audit result goes to disk, so Home still shows it after Revit / the model is reopened."""
    try:
        _write_json(TKX_AUDIT_PATH, {u"format": 1, u"res": res})
    except Exception as ex:
        tk_log(u"audit save: {}".format(ex))


def tkx_audit_load():
    try:
        d = _read_json(TKX_AUDIT_PATH)
        r = d.get(u"res") if isinstance(d, dict) else None
        if isinstance(r, dict) and r.get(u"doc") and r.get(u"filesize") is not None and r.get(u"warnings") is not None:
            return r
    except Exception as ex:
        tk_log(u"audit load: {}".format(ex))
    return None


def tkx_when(t):
    """Time of the audit: just the time for today, with the date for an older result."""
    try:
        if time.strftime(u"%Y%m%d", time.localtime(t)) == time.strftime(u"%Y%m%d"):
            return time.strftime(u"%H:%M", time.localtime(t))
        return time.strftime(u"%d.%m.%Y %H:%M", time.localtime(t))
    except Exception:
        return u""


def tkx_audit_numbers(res):
    fs = res[u"filesize"][u"mb"]
    out = {u"warnings": res[u"warnings"][u"n"], u"inplace": res[u"inplace"][u"n"], u"imports": res[u"imports"][u"n"],
           u"filters": res[u"filters"][u"n"], u"templates": res[u"templates"][u"n"], u"patterns": res[u"patterns"][u"n"],
           u"filesize": int(fs) if fs is not None else 0, u"offsheet": res[u"offsheet"][u"n"],
           u"groups": res[u"groups"][u"n"], u"rooms": res[u"rooms"][u"n"], u"options": res[u"options"][u"n"],
           u"dups": res[u"dups"][u"n"]}
    for k in (u"links", u"unpinned", u"emptysheets", u"notemplate"):        # results saved by an older build do not have them
        try:
            out[k] = int((res.get(k) or {}).get(u"n", 0))
        except Exception:
            pass
    cl = res.get(u"clashes") or {}
    if cl.get(u"ran") and not cl.get(u"partial"):
        out[u"clashes"] = int(cl.get(u"n", 0))
    uf = res.get(u"unusedfam") or {}
    if uf.get(u"ran"):
        out[u"unusedfam"] = int(uf.get(u"n", 0))
    return out


def tkx_audit_tiles(res, prev):
    """The tiles; items of stages that were not run (a partial Deep audit) show a dash instead of a false 0."""
    sk = res.get(u"skipped") or []
    out = []
    for tl in _tkx_audit_tiles_raw(res, prev):
        if sk and TKX_ITEM_STAGE.get(tl[0]) in sk:
            out.append((tl[0], u"\u2013", tl[2], u"info", u"not run", 0.0))
        else:
            out.append(tl)
    return out


def _tkx_audit_tiles_raw(res, prev):
    """[(key, value, label, level ok/warn/bad/info, label-2, bar fraction)]"""
    prev = prev or {}
    cur = tkx_audit_numbers(res)

    def delta(k):
        if k in prev and k in cur and prev[k] != cur[k]:
            dd = cur[k] - prev[k]
            return u"{}{} from last time".format(u"+" if dd > 0 else u"\u2212", abs(dd))
        return u""

    def T(key, valtxt, cap, num, sub):
        lv, fr = tkx_level(key, num)
        return (key, valtxt, cap, lv, sub, fr)
    mb = res[u"filesize"][u"mb"]
    fs_txt = u"\u2013" if mb is None else (u"{:.0f}".format(mb) if mb >= 100 else u"{:.1f}".format(mb))
    fs_sub = tkx_short(os.path.basename(res[u"filesize"][u"path"]), 22) if mb is not None else u"unavailable"
    vw = res[u"views"]
    vi = vw[u"items"]
    fi = res[u"families"][u"items"]
    rm = res[u"rooms"]
    extra = []
    cl = res.get(u"clashes") or {}
    if cl.get(u"ran"):
        extra.append(T(u"clashes", tkx_num(cl[u"n"]) + (u"+" if cl.get(u"partial") else u""), u"clashes (approx.)", cl[u"n"],
                       u"incomplete (Esc)" if cl.get(u"partial") else u"{} elements checked".format(tkx_num(cl.get(u"total", 0)))))
    else:
        extra.append(T(u"clashes", u"\u2013", u"clashes (approx.)", None, u"Deep audit"))
    for key_, cap_, none_ in ((u"links", u"Revit links with issues", u"no links"),
                              (u"unpinned", u"unpinned levels and grids", u""),
                              (u"emptysheets", u"sheets without views", u""),
                              (u"notemplate", u"views on sheets without template", u"")):
        k_ = res.get(key_)
        if not k_:                                                  # an audit saved by an older build has no such data
            extra.append(T(key_, u"\u2013", cap_, None, u"re-run the audit"))
        else:
            extra.append(T(key_, tkx_num(k_.get(u"n", 0)), cap_, k_.get(u"n", 0),
                           u"of {}".format(k_[u"total"]) if k_.get(u"total") else none_))
    uf = res.get(u"unusedfam") or {}
    if uf.get(u"ran"):
        extra.append(T(u"unusedfam", tkx_num(uf[u"n"]), u"unused families (approx.)", uf[u"n"],
                       u"of {}".format(uf[u"total"]) if uf.get(u"total") else u""))
    else:
        extra.append(T(u"unusedfam", u"\u2013", u"unused families (approx.)", None, u"needs a full count"))
    return [
        T(u"filesize", fs_txt, u"file size, MB", mb, fs_sub),
        T(u"imports", tkx_num(cur[u"imports"]), u"CAD imports", cur[u"imports"],
          (u"links: {}".format(res[u"imports"][u"linked"]) if res[u"imports"][u"linked"] else delta(u"imports"))),
        T(u"warnings", tkx_num(cur[u"warnings"]), u"Revit warnings", cur[u"warnings"], delta(u"warnings")),
        T(u"inplace", tkx_num(cur[u"inplace"]), u"in-place families", cur[u"inplace"], delta(u"inplace")),
        T(u"offsheet", tkx_num(cur[u"offsheet"]), u"views not on sheets", cur[u"offsheet"],
          u"of {}".format(tkx_num(res[u"offsheet"][u"total"])) if res[u"offsheet"][u"total"] else u""),
        T(u"groups", tkx_num(cur[u"groups"]), u"model groups (types)", cur[u"groups"],
          u"inst.: {}".format(tkx_num(res[u"groups"][u"inst"])) if res[u"groups"][u"inst"] else delta(u"groups")),
        T(u"rooms", tkx_num(cur[u"rooms"]), u"unplaced rooms", cur[u"rooms"],
          u"unenclosed: {}".format(rm[u"unenclosed"]) if rm[u"unenclosed"] else (u"of {}".format(rm[u"total"]) if rm[u"total"] else u"")),
        T(u"options", tkx_num(cur[u"options"]), u"design options", cur[u"options"], delta(u"options")),
        T(u"dups", tkx_num(cur[u"dups"]), u"duplicate elements", cur[u"dups"], u"from Revit warnings"),
        T(u"filters", tkx_num(cur[u"filters"]), u"unused filters", cur[u"filters"],
          u"of {}".format(res[u"filters"][u"total"]) if res[u"filters"][u"total"] else u""),
        T(u"templates", tkx_num(cur[u"templates"]), u"unused view templates", cur[u"templates"],
          u"of {}".format(res[u"templates"][u"total"]) if res[u"templates"][u"total"] else u""),
        T(u"patterns", tkx_num(cur[u"patterns"]), u"unused line patterns", cur[u"patterns"],
          (u"of {}".format(res[u"patterns"][u"total"]) if res[u"deep"] else u"approx., of {}".format(res[u"patterns"][u"total"]))
          if res[u"patterns"][u"total"] else u""),
    ] + extra + [
        T(u"views", tkx_num(vi[0][2]) if vi else u"\u2013", u"elements in the heaviest view", None,
          tkx_short(vi[0][0], 22) if vi else u"Deep audit"),
        T(u"families", tkx_num(fi[0][2]) if fi else u"\u2013", u"instances of the largest family", None,
          tkx_short(fi[0][0], 22) if fi else u""),
    ]


def tkx_audit_detail(res, key):
    """(title, rows) for a tile."""
    if key == u"filesize":
        fs = res[u"filesize"]
        if fs[u"mb"] is None:
            return (u"File size unavailable", [u"The model is not saved to disk or is in the cloud (BIM 360 / ACC)."])
        return (u"File size: {:.1f} MB".format(fs[u"mb"]),
                [fs[u"path"], u"Thresholds: from {} MB - attention, from {} MB - critical".format(*TKX_LIMITS[u"filesize"])])
    if key == u"warnings":
        w = res[u"warnings"]
        return (u"Warnings: {} pcs, {} views".format(w[u"n"], len(w[u"items"])),
                tkx_cap([u"{} \u00D7  {}".format(n, tkx_short(t, 110)) for t, n in w[u"items"]], 25))
    if key == u"dups":
        dp = res[u"dups"]
        return (u"Duplicates: {} warnings about identical instances in the same place".format(dp[u"n"]),
                tkx_cap(list(dp[u"items"])))
    if key == u"inplace":
        return (u"In-place families: {}".format(res[u"inplace"][u"n"]),
                tkx_cap([u"{}  [{}]  \u2014 {} inst.".format(n, c, k) for n, c, k in res[u"inplace"][u"items"]]))
    if key == u"imports":
        im = res[u"imports"]
        L = [u"{}{}".format(n, u"  (in one view only)" if vs else u"") for n, vs in im[u"items"]]
        if im[u"linked"]:
            L.append(u"CAD links (Link CAD): {}".format(im[u"linked"]))
        return (u"Imported CAD (Import CAD): {}".format(im[u"n"]), tkx_cap(L))
    if key == u"offsheet":
        o = res[u"offsheet"]
        L = []
        if o[u"by"]:
            L.append(u"By type: " + u"  \u00B7  ".join(u"{} {}".format(t, n) for t, n in o[u"by"]))
            L.append(u"")
        L.extend(u"{}  [{}]".format(n, t) for n, t in o[u"items"])
        return (u"Views that are on no sheet: {} of {} (excluding schedules, templates and the sheets themselves)".format(
            o[u"n"], o[u"total"]), tkx_cap(L, 80))
    if key == u"groups":
        g = res[u"groups"]
        return (u"Model groups: {} types, {} instances".format(g[u"n"], g[u"inst"]),
                tkx_cap([u"{} \u00D7  {}".format(k, n) for n, k in g[u"items"]]))
    if key == u"rooms":
        r = res[u"rooms"]
        return (u"Unplaced rooms (Not Placed): {}; not enclosed (Not Enclosed): {}; total rooms: {}".format(
            r[u"n"], r[u"unenclosed"], r[u"total"]), tkx_cap(list(r[u"items"])))
    if key == u"options":
        return (u"Design options: {}".format(res[u"options"][u"n"]), tkx_cap(list(res[u"options"][u"items"])))
    if key == u"filters":
        return (u"View filters not applied in any view or template: {}".format(res[u"filters"][u"n"]),
                tkx_cap(list(res[u"filters"][u"items"])))
    if key == u"templates":
        return (u"View templates not assigned to any view: {}".format(res[u"templates"][u"n"]),
                tkx_cap(list(res[u"templates"][u"items"])))
    if key == u"patterns":
        return (u"Line patterns not found in category styles and overrides: {} (check manually)".format(res[u"patterns"][u"n"]),
                tkx_cap(list(res[u"patterns"][u"items"])))
    if key == u"views":
        v = res[u"views"]
        if not v.get(u"deep"):
            return (u"Heaviest views: Deep audit required",
                    [u"The Deep audit checks every view with no time limit (dependent views are skipped).",
                     u"For large models this can take a long time; Esc cancels and keeps what was collected."])
        when = time.strftime(u"%H:%M", time.localtime(v[u"t"])) if v.get(u"t") else u""
        title = u"Heaviest views (elements in the view, checked {} of {}; dependent skipped {}; deep audit {})".format(
            v[u"checked"], v[u"total"], v.get(u"skipped", 0), when)
        return (title, [u"{}  \u2014  {}  [{}]{}".format(tkx_num(n), nm, t, u"  \u00B7  on a sheet" if on else u"")
                        for nm, t, n, on in v[u"items"]])
    if key == u"families":
        return (u"Families with the most instances",
                [u"{}  \u2014  {}  [{}]".format(tkx_num(n), nm, c) for nm, c, n in res[u"families"][u"items"]])
    if key == u"clashes":
        c = res.get(u"clashes") or {}
        if not c.get(u"ran"):
            return (u"Clashes: Deep audit required",
                    [u"The Deep audit checks geometric intersections between pairs of categories: ducts, pipes and cable trays against each other and against beams and columns; walls, floors and columns that overlap each other.",
                     u"Joined walls and floors are skipped. The check is approximate: it finds intersecting solids, not clearances (soft clashes).",
                     u"Elements from Revit links are not checked. Esc cancels the audit and keeps what was found."])
        L = []
        if c.get(u"pairs"):
            L.append(u"By type: " + u"  \u00B7  ".join(u"{} {}".format(t, n) for t, n in c[u"pairs"]))
            L.append(u"")
        L.extend(c.get(u"items") or [])
        L = tkx_cap(L, 80)
        miss = c.get(u"n", 0) - len(c.get(u"items") or [])
        if miss > 0 and not (L and L[-1].startswith(u"\u2026 and ")):
            L.append(u"\u2026 and {} more (list limit {})".format(miss, TKX_CLASH_LIST))
        return (u"Clashes (approx.): {} in {} category pairs; {} elements checked{}".format(
            c.get(u"n", 0), len(c.get(u"pairs") or []), c.get(u"total", 0), u"; incomplete (Esc)" if c.get(u"partial") else u""), L)
    if key == u"links":
        k = res.get(u"links") or {}
        return (u"Revit links: {} with issues of {} (not loaded, not found, not placed, not pinned)".format(k.get(u"n", 0), k.get(u"total", 0)),
                tkx_cap(list(k.get(u"items") or [])))
    if key == u"unpinned":
        k = res.get(u"unpinned") or {}
        return (u"Levels and grids that are not pinned: {} of {}".format(k.get(u"n", 0), k.get(u"total", 0)),
                tkx_cap(list(k.get(u"items") or [])))
    if key == u"emptysheets":
        k = res.get(u"emptysheets") or {}
        return (u"Sheets with no views, legends or schedules: {} of {} (placeholders excluded)".format(k.get(u"n", 0), k.get(u"total", 0)),
                tkx_cap(list(k.get(u"items") or []), 80))
    if key == u"notemplate":
        k = res.get(u"notemplate") or {}
        return (u"Views on sheets with no view template: {} of {} placed views (plans, sections, elevations, 3D, drafting)".format(
            k.get(u"n", 0), k.get(u"total", 0)), tkx_cap(list(k.get(u"items") or []), 80))
    if key == u"unusedfam":
        k = res.get(u"unusedfam") or {}
        if not k.get(u"ran"):
            return (u"Unused families: a full family count is needed",
                    [u"The quick audit stopped counting family instances at the time limit. Run the Deep audit (no limit) or raise the limit."])
        return (u"Loaded model families with no instances: {} of {} (approx.: a family used only inside another family or a railing may be listed)".format(
            k.get(u"n", 0), k.get(u"total", 0)), tkx_cap(list(k.get(u"items") or []), 80))
    return (u"", [])


# ---------------------------------------------------------------------------
#  Audit rows -> "show in the model".
#  Model elements: select + Selection Box (section box in a 3D view) + highlight colour in that view.
#  Views: open. Filters / templates / line patterns / design options: nothing to see in a view -> open the Revit dialog.
# ---------------------------------------------------------------------------
TKX_SHOW_MAX = 5000                 # elements per click
TKX_HL_RGB = (255, 0, 160)          # highlight colour (magenta: does not clash with Revit's blue selection or red warnings)


def tkx_audit_targets(res, key):
    """Click targets of the detail rows, in the order of the tile's items. A missing target = the row is not clickable."""
    T = []
    try:
        if key == u"warnings":
            T = [{u"kind": u"warn", u"text": t} for t, n in res[u"warnings"][u"items"]]
        elif key == u"dups":
            T = [{u"kind": u"el", u"ids": list(x)} for x in res[u"dups"].get(u"ids", [])]
        elif key == u"inplace":
            T = [{u"kind": u"family", u"fids": [f]} for f in res[u"inplace"].get(u"ids", [])]
        elif key == u"families":
            T = [{u"kind": u"family", u"fids": [f]} for f in res[u"families"].get(u"ids", [])]
        elif key == u"imports":
            T = [{u"kind": u"el", u"ids": [i]} for i in res[u"imports"].get(u"ids", [])]
        elif key == u"offsheet":
            T = [{u"kind": u"view", u"id": i} for i in res[u"offsheet"].get(u"ids", [])]
        elif key == u"views":
            T = [{u"kind": u"view", u"id": i} for i in res[u"views"].get(u"ids", [])]
        elif key == u"groups":
            T = [{u"kind": u"group", u"tids": [i]} for i in res[u"groups"].get(u"ids", [])]
        elif key == u"rooms":
            T = [{u"kind": u"el", u"ids": [i]} for i in res[u"rooms"].get(u"ids", [])]
        elif key == u"options":
            T = [{u"kind": u"cmd", u"cmds": [u"DesignOptions"], u"what": u"Design Options"}
                 for _ in res[u"options"][u"items"]]
        elif key == u"filters":
            T = [{u"kind": u"cmd", u"cmds": [u"Filters", u"VisibilityGraphics"], u"copy": n,
                  u"what": u"Filters (View > Filters, or Visibility/Graphics > Filters)"} for n in res[u"filters"][u"items"]]
        elif key == u"templates":
            T = [{u"kind": u"cmd", u"cmds": [u"ViewTemplates", u"ManageViewTemplates"], u"copy": n,
                  u"what": u"View Templates (View > View Templates > Manage)"} for n in res[u"templates"][u"items"]]
        elif key == u"patterns":
            T = [{u"kind": u"cmd", u"cmds": [u"LinePatterns"], u"copy": n,
                  u"what": u"Line Patterns (Manage > Additional Settings > Line Patterns)"} for n in res[u"patterns"][u"items"]]
        elif key == u"clashes":
            T = [{u"kind": u"el", u"ids": list(x)} for x in (res.get(u"clashes") or {}).get(u"ids", [])]
        elif key == u"links":
            lk = res.get(u"links") or {}
            names = lk.get(u"names") or []
            for i, ids in enumerate(lk.get(u"ids", [])):
                if ids:
                    T.append({u"kind": u"el", u"ids": list(ids)})
                else:
                    T.append({u"kind": u"cmd", u"cmds": [u"ManageLinks"], u"copy": names[i] if i < len(names) else u"",
                              u"what": u"Manage Links (Insert > Manage Links)"})
        elif key == u"unpinned":
            T = [{u"kind": u"el", u"ids": [i]} for i in (res.get(u"unpinned") or {}).get(u"ids", [])]
        elif key == u"emptysheets":
            T = [{u"kind": u"view", u"id": i} for i in (res.get(u"emptysheets") or {}).get(u"ids", [])]
        elif key == u"notemplate":
            T = [{u"kind": u"view", u"id": i} for i in (res.get(u"notemplate") or {}).get(u"ids", [])]
        elif key == u"unusedfam":
            T = [{u"kind": u"cmd", u"cmds": [u"PurgeUnused"], u"copy": n,
                  u"what": u"Purge Unused (Manage > Purge Unused)"} for n in (res.get(u"unusedfam") or {}).get(u"names", [])]
    except Exception as ex:
        tk_log(u"audit targets {}: {}".format(key, ex))
        T = []
    return T


def tkx_audit_all(res, key):
    """The 'Show all' target for a tile (all rows at once) or None."""
    try:
        if key == u"dups":
            ids = []
            for x in res[u"dups"].get(u"ids", []):
                ids.extend(x)
            return {u"kind": u"el", u"ids": ids} if ids else None
        if key == u"inplace" and res[u"inplace"].get(u"ids"):
            return {u"kind": u"family", u"fids": list(res[u"inplace"][u"ids"])}
        if key == u"groups" and res[u"groups"].get(u"ids"):
            return {u"kind": u"group", u"tids": list(res[u"groups"][u"ids"])}
        if key == u"imports" and res[u"imports"].get(u"ids"):
            return {u"kind": u"el", u"ids": list(res[u"imports"][u"ids"])}
        if key == u"clashes":
            ids = []
            for x in (res.get(u"clashes") or {}).get(u"ids", []):
                ids.extend(x)
            return {u"kind": u"el", u"ids": ids} if ids else None
        if key == u"unpinned" and (res.get(u"unpinned") or {}).get(u"ids"):
            return {u"kind": u"el", u"ids": list(res[u"unpinned"][u"ids"])}
    except Exception:
        pass
    return None


def tkx_audit_rows(res, key):
    """(title, [(text, target or None)]): the detail rows of a tile with what a click on each does.
    The texts are exactly those of tkx_audit_detail (the report and 'Copy report' stay unchanged)."""
    title, lines = tkx_audit_detail(res, key)
    tg = tkx_audit_targets(res, key)
    off = 0                                                                 # header lines before the items
    if key == u"offsheet" and res[u"offsheet"][u"by"]:
        off = 2
    elif key == u"clashes" and (res.get(u"clashes") or {}).get(u"pairs"):
        off = 2
    rows = []
    for i, ln in enumerate(lines):
        j = i - off
        t = None
        if 0 <= j < len(tg) and not ln.startswith(u"\u2026 and "):
            t = tg[j]
        rows.append((ln, t))
    return title, rows


def tkx_target_glyph(tg):
    """Icon at the right of a clickable row: view / dialog / show in model."""
    k = tg.get(u"kind")
    if k == u"view":
        return u"\uE8A7"          # open
    if k == u"cmd":
        return u"\uE713"          # settings (a Revit dialog)
    return u"\uE7B3"              # eye: show in the model


def tkx_target_hint(tg):
    k = tg.get(u"kind")
    if k == u"view":
        return u"open view"
    if k == u"cmd":
        return u"open dialog"
    return u"show in model"


def tkx_resolve_ids(d, tg):
    """(element ids as ints, note) for a row target. Runs in the Revit context (fresh data, not the audit snapshot)."""
    k = tg.get(u"kind")
    out, seen = [], set()

    def add(i):
        if i not in seen:
            seen.add(i)
            out.append(i)
    if k == u"el":
        for i in tg.get(u"ids", []):
            add(int(i))
    elif k == u"warn":
        want = tg.get(u"text")
        for w in d.GetWarnings():
            try:
                if unicode(w.GetDescriptionText()) != want:
                    continue
                for x in list(w.GetFailingElements()):
                    add(id_value(x))
                try:
                    for x in list(w.GetAdditionalElements()):
                        add(id_value(x))
                except Exception:
                    pass
            except Exception:
                pass
            if len(out) >= TKX_SHOW_MAX:
                break
    elif k == u"family":
        for fid in tg.get(u"fids", []):
            fam = d.GetElement(revit_id(fid))
            if fam is None:
                continue
            failed = False
            try:
                for sid in fam.GetFamilySymbolIds():
                    for x in FilteredElementCollector(d).WherePasses(DB.FamilyInstanceFilter(d, sid)).ToElementIds():
                        add(id_value(x))
            except Exception:
                failed = True
            if failed:                       # fallback: a full scan of the family instances
                for fi in FilteredElementCollector(d).OfClass(DB.FamilyInstance):
                    try:
                        if id_value(fi.Symbol.Family.Id) == int(fid):
                            add(id_value(fi.Id))
                    except Exception:
                        pass
            if len(out) >= TKX_SHOW_MAX:
                break
    elif k == u"group":
        want = set(int(t) for t in tg.get(u"tids", []))
        for g in FilteredElementCollector(d).OfClass(DB.Group):
            try:
                if id_value(g.GetTypeId()) in want:
                    add(id_value(g.Id))
            except Exception:
                pass
            if len(out) >= TKX_SHOW_MAX:
                break
    note = u""
    if len(out) > TKX_SHOW_MAX:
        out = out[:TKX_SHOW_MAX]
    if len(out) >= TKX_SHOW_MAX:
        note = u"first {} only".format(TKX_SHOW_MAX)
    return out, note


def tkx_elem_box(e):
    """((minx, miny, minz), (maxx, maxy, maxz)) in model coordinates or None (unplaced room, no geometry)."""
    try:
        bb = e.get_BoundingBox(None)
    except Exception:
        return None
    if bb is None:
        return None
    try:
        tf = bb.Transform
        pts = []
        for x in (bb.Min.X, bb.Max.X):
            for y in (bb.Min.Y, bb.Max.Y):
                for z in (bb.Min.Z, bb.Max.Z):
                    p = XYZ(x, y, z)
                    if tf is not None:
                        p = tf.OfPoint(p)
                    pts.append((p.X, p.Y, p.Z))
        return (tuple(min(p[i] for p in pts) for i in range(3)), tuple(max(p[i] for p in pts) for i in range(3)))
    except Exception:
        return None


def tkx_union_box(boxes):
    """Section box around all the boxes, with a margin (like the Selection Box command)."""
    lo = [min(b[0][i] for b in boxes) for i in range(3)]
    hi = [max(b[1][i] for b in boxes) for i in range(3)]
    ext = max(hi[i] - lo[i] for i in range(3))
    m = min(30.0, max(1.0, 0.1 * ext))
    bb = DB.BoundingBoxXYZ()
    bb.Min = XYZ(lo[0] - m, lo[1] - m, lo[2] - m)
    bb.Max = XYZ(hi[0] + m, hi[1] + m, hi[2] + m)
    return bb


def tkx_solid_fill_id(d):
    for fp in FilteredElementCollector(d).OfClass(DB.FillPatternElement):
        try:
            p = fp.GetFillPattern()
            if p.IsSolidFill and p.Target == DB.FillPatternTarget.Drafting:
                return fp.Id
        except Exception:
            pass
    return None


def tkx_hl_ogs(d):
    """Graphic override for the highlight: surface filled with the colour (solid), black lines, no halftone."""
    og = DB.OverrideGraphicSettings()
    col = DB.Color(TKX_HL_RGB[0], TKX_HL_RGB[1], TKX_HL_RGB[2])
    solid = tkx_solid_fill_id(d)

    def put(fn, *args):
        try:
            getattr(og, fn)(*args)
            return True
        except Exception:
            return False
    black = DB.Color(0, 0, 0)                                  # lines stay black: only the surface is filled with the colour
    put("SetProjectionLineColor", black)
    put("SetCutLineColor", black)
    if not put("SetSurfaceForegroundPatternColor", col):
        put("SetProjectionFillColor", col)                    # Revit < 2019
    if not put("SetCutForegroundPatternColor", col):
        put("SetCutFillColor", col)
    if solid is not None:
        if not put("SetSurfaceForegroundPatternId", solid):
            put("SetProjectionFillPatternId", solid)
        if not put("SetCutForegroundPatternId", solid):
            put("SetCutFillPatternId", solid)
    put("SetHalftone", False)
    put("SetSurfaceTransparency", 0)
    return og


def tkx_hl_restore(d, st):
    """Inside a transaction: returns the view to what it was before the highlight (overrides, hidden elements, section box)."""
    if not st or st.get(u"doc") != unicode(d.Title):
        return
    v = d.GetElement(revit_id(st[u"view"]))
    if v is None:
        return
    for i, og in st[u"ov"].items():
        try:
            v.SetElementOverrides(revit_id(i), og)
        except Exception:
            pass
    if st.get(u"hid"):
        try:
            v.HideElements(List[ElementId]([revit_id(i) for i in st[u"hid"]]))
        except Exception:
            pass
    sb = st.get(u"sb")
    if sb is not None:
        try:
            v.SetSectionBox(sb[1])
        except Exception:
            pass
        try:
            v.IsSectionBoxActive = sb[0]
        except Exception:
            pass


def tkx_pick_3d(uiapp_, ui, d):
    """3D view for the Selection Box: the active one if it is an unlocked isometric 3D view, else the default {3D}; None = create."""
    def usable(v):
        try:
            if not isinstance(v, DB.View3D) or v.IsTemplate or v.IsPerspective:
                return False
        except Exception:
            return False
        try:
            if v.IsLocked:
                return False
        except Exception:
            pass
        return True
    try:
        av = ui.ActiveView
        if usable(av):
            return av
    except Exception:
        pass
    user = u""
    try:
        user = unicode(uiapp_.Application.Username or u"")
    except Exception:
        pass
    best, rank = None, 99
    for v in FilteredElementCollector(d).OfClass(DB.View3D):
        if not usable(v):
            continue
        nm = unicode(v.Name)
        r = 0 if (user and nm == u"{3D - " + user + u"}") else (1 if nm == u"{3D}" else (2 if nm.startswith(u"{3D") else 3))
        if r < rank:
            best, rank = v, r
    return best


def tkx_make_3d(d):
    vft = None
    for t in FilteredElementCollector(d).OfClass(DB.ViewFamilyType):
        try:
            if t.ViewFamily == DB.ViewFamily.ThreeDimensional:
                vft = t
                break
        except Exception:
            pass
    if vft is None:
        fail(u"The model has no 3D view type")
    v = DB.View3D.CreateIsometric(d, vft.Id)
    try:
        v.Name = u"{3D}"
    except Exception:
        pass
    return v


def tkx_visible_in(d, view, ids):
    """Which of the ids are visible in the view (None = could not check)."""
    try:
        lst = List[ElementId]([revit_id(i) for i in ids])
        col = FilteredElementCollector(d, view.Id)
        if ElementIdSetFilter is not None:
            return set(id_value(x) for x in col.WherePasses(ElementIdSetFilter(lst)).ToElementIds())
        want = set(ids)
        return set(id_value(x) for x in col.WhereElementIsNotElementType().ToElementIds() if id_value(x) in want)
    except Exception:
        return None


def tkx_audit_report(res):
    L = [u"Model audit ({}): {}".format(u"deep" if res.get(u"deep") else u"quick", res[u"doc"]),
         u"Time: " + time.strftime(u"%Y-%m-%d %H:%M", time.localtime(res[u"t"])) + u"  ({:.1f} s)".format(res.get(u"dur", 0)), u""]
    for key in (u"filesize", u"imports", u"warnings", u"inplace", u"offsheet", u"groups", u"rooms", u"options", u"dups",
                u"filters", u"templates", u"patterns", u"clashes", u"links", u"unpinned", u"emptysheets", u"notemplate",
                u"unusedfam", u"views", u"families"):
        title, lines = tkx_audit_detail(res, key)
        L.append(title)
        L.extend(u"  " + x for x in lines)
        L.append(u"")
    for n in res.get(u"notes", []):
        L.append(u"! " + n)
    for e in res.get(u"err", []):
        L.append(u"! step error \u2014 " + e)
    return tkx_scrub(u"\n".join(L))


# ---------------------------------------------------------------------------
#  Audit report to model: drafting view / legend / sheet (the model is CHANGED here, only on click)
# ---------------------------------------------------------------------------
TK_RPT_PREFIX = u"TK Audit"
TK_RPT_ORDER = (u"warnings", u"dups", u"inplace", u"imports", u"offsheet", u"groups", u"rooms", u"options",
                u"filters", u"templates", u"patterns", u"clashes", u"links", u"unpinned", u"emptysheets", u"notemplate",
                u"unusedfam", u"views", u"families")

# What can go into the report model, item by item: (key, caption, has a full list).
# Mode per item: 0 = not in the report, 1 = the metric tile only, 2 = tile + the full list (Extended only).
TK_RPT_ITEMS = [
    (u"filesize", u"File size", False),
    (u"imports", u"CAD imports", True),
    (u"warnings", u"Revit warnings", True),
    (u"dups", u"Duplicate elements", True),
    (u"inplace", u"In-place families", True),
    (u"offsheet", u"Views not on sheets", True),
    (u"groups", u"Model groups", True),
    (u"rooms", u"Rooms (not placed / not enclosed)", True),
    (u"options", u"Design options", True),
    (u"filters", u"Unused filters", True),
    (u"templates", u"Unused view templates", True),
    (u"patterns", u"Unused line patterns", True),
    (u"clashes", u"Clashes", True),
    (u"links", u"Revit links", True),
    (u"unpinned", u"Unpinned levels and grids", True),
    (u"emptysheets", u"Sheets without views", True),
    (u"notemplate", u"Views on sheets without template", True),
    (u"unusedfam", u"Unused families", True),
    (u"views", u"Heaviest views", True),
    (u"families", u"Largest families", True),
]
TK_RPT_COMPACT = (u"filesize", u"imports", u"warnings", u"inplace", u"offsheet", u"groups", u"rooms", u"options", u"dups")
TK_RPT_SCHEDS = ((u"offsheet", u"Views not on sheets"), (u"rooms", u"Rooms not placed or not enclosed"))


def tkx_rpt_has_list(key):
    for k, c, l in TK_RPT_ITEMS:
        if k == key:
            return l
    return False


def tkx_rpt_default_sel(fmt):
    sel = {}
    for key, cap, lst in TK_RPT_ITEMS:
        if fmt == u"compact":
            sel[key] = 1 if key in TK_RPT_COMPACT else 0
        else:
            sel[key] = 2 if lst else 1
    return sel


def tkx_rpt_norm_sel(fmt, raw):
    """Selection of a format: defaults, overridden by the saved values; unknown keys are dropped."""
    sel = tkx_rpt_default_sel(fmt)
    if isinstance(raw, dict):
        for key, cap, lst in TK_RPT_ITEMS:
            try:
                v = int(raw.get(key, sel[key]))
            except Exception:
                continue
            sel[key] = max(0, min(v, 2 if (lst and fmt != u"compact") else 1))
    return sel


def tkx_item_avail(res, key):
    """False when this audit result has no data for the item (Deep-only data that was not collected)."""
    try:
        if TKX_ITEM_STAGE.get(key) in (res.get(u"skipped") or []):
            return False
        if key == u"filesize":
            return res[u"filesize"][u"mb"] is not None
        if key == u"clashes":
            return bool((res.get(u"clashes") or {}).get(u"ran"))
        if key == u"unusedfam":
            return bool((res.get(u"unusedfam") or {}).get(u"ran"))
        if key == u"views":
            return bool((res.get(u"views") or {}).get(u"deep"))
        if key == u"families":
            return bool(res[u"families"][u"items"])
        if key in (u"links", u"unpinned", u"emptysheets", u"notemplate"):
            return bool(res.get(key))
    except Exception:
        return False
    return True


def tkx_rpt_dup(d, base, full):
    """Type by name: find an existing one (case/whitespace-insensitive) or create it by duplicating base.
    If Duplicate throws "name is already in use", looks for the type under this or a suffixed name."""
    cls = base.GetType()

    def find(nm):
        key = unicode(nm).strip().lower()
        for x in FilteredElementCollector(d).OfClass(cls):
            try:
                if unicode(x.Name).strip().lower() == key:
                    return x
            except Exception:
                pass
        return None
    last = None
    for i in range(1, 20):
        nm = full if i == 1 else u"{} ({})".format(full, i)
        t = find(nm)
        if t is not None:
            return t
        try:
            return base.Duplicate(nm)
        except Exception as ex:
            last = ex
            t = find(nm)
            if t is not None:
                return t
            tk_log(u"report: Duplicate '{}' failed: {}".format(nm, ex))
    raise Exception(u"could not create the type \"{}\": {}".format(full, last))


TK_RPT_TSPEC = [
    # key, type name, size mm, bold, color
    (u"title", u"Title", 15.0, True, (29, 29, 31)),
    (u"lead", u"Lead", 4.6, False, (110, 110, 115)),
    (u"sec", u"Section", 7.5, True, (29, 29, 31)),
    (u"ctitle", u"Card Heading", 4.8, True, (29, 29, 31)),
    (u"csub", u"Card Subtitle", 2.9, False, (134, 134, 139)),
    (u"metric", u"Metric", 12.0, True, (29, 29, 31)),
    (u"m_warn", u"Metric Warn", 12.0, True, (255, 149, 0)),
    (u"m_bad", u"Metric Bad", 12.0, True, (255, 59, 48)),
    (u"cap", u"Caption", 3.0, False, (110, 110, 115)),
    (u"mini", u"Mini", 2.6, False, (142, 142, 147)),
    (u"num", u"Row Number", 3.1, True, (29, 29, 31)),
    (u"row", u"Row", 3.1, False, (58, 58, 60)),
    (u"alert", u"Alert", 3.0, False, (200, 110, 0)),
    (u"foot", u"Footer", 2.6, False, (174, 174, 178)),
    (u"cm_val", u"Compact Value", 7.5, True, (29, 29, 31)),
    (u"cm_warn", u"Compact Value Warn", 7.5, True, (255, 149, 0)),
    (u"cm_bad", u"Compact Value Bad", 7.5, True, (255, 59, 48)),
]


def tkx_rpt_types(d):
    """Text types for the report (Apple style): created once, then reused."""
    base = d.GetElement(d.GetDefaultElementTypeId(DB.ElementTypeGroup.TextNoteType))
    existing = {}
    for t in FilteredElementCollector(d).OfClass(DB.TextNoteType):
        try:
            existing[unicode(t.Name)] = t
        except Exception:
            pass

    def setp(t, names, val):
        for nm in names:
            bip = getattr(DB.BuiltInParameter, nm, None)
            if bip is None:
                continue
            try:
                p = t.get_Parameter(bip)
                if p is not None and not p.IsReadOnly:
                    p.Set(val)
                    return
            except Exception:
                pass
    out = {}
    for key, nm, mm, bold, c in TK_RPT_TSPEC:
        full = u"{} - {}".format(TK_RPT_PREFIX, nm)
        t = existing.get(full)
        if t is None:
            t = tkx_rpt_dup(d, base, full)
        setp(t, (u"TEXT_SIZE",), mm / 304.8)
        setp(t, (u"TEXT_STYLE_BOLD",), 1 if bold else 0)
        setp(t, (u"TEXT_STYLE_ITALIC",), 0)
        setp(t, (u"TEXT_STYLE_UNDERLINE",), 0)
        setp(t, (u"TEXT_FONT",), u"Segoe UI")
        setp(t, (u"TEXT_BACKGROUND",), 1)
        setp(t, (u"TEXT_BOX_VISIBILITY",), 0)
        setp(t, (u"LINE_COLOR", u"TEXT_COLOR"), c[0] + c[1] * 256 + c[2] * 65536)
        out[key] = t.Id
    return out


def tkx_rpt_region_types(d):
    """Filled Region types (solid fill, no outline) for cards and bars.
    Looks for the solid fill and a base type where possible; if there are none, tries to create one."""
    solid, n_pat, n_solid = None, 0, 0
    for fp in FilteredElementCollector(d).OfClass(DB.FillPatternElement):
        n_pat += 1
        try:
            pat = fp.GetFillPattern()
            if pat.IsSolidFill:
                n_solid += 1
                if solid is None or unicode(pat.Target) == u"Drafting":
                    solid = fp
        except Exception:
            pass
    if solid is None:
        for nm in (u"<Solid fill>", u"Solid fill", u"<\u0421\u0443\u0446\u0456\u043b\u044c\u043d\u0430 \u0437\u0430\u043b\u0438\u0432\u043a\u0430>", u"\u0421\u0443\u0446\u0456\u043b\u044c\u043d\u0430 \u0437\u0430\u043b\u0438\u0432\u043a\u0430"):
            try:
                solid = DB.FillPatternElement.GetFillPatternElementByName(d, DB.FillPatternTarget.Drafting, nm)
            except Exception:
                solid = None
            if solid is not None:
                break
    if solid is None:
        try:
            solid = DB.FillPatternElement.Create(d, DB.FillPattern())      # a constructor without arguments = solid fill
        except Exception as ex:
            tk_log(u"report: FillPattern.Create: {}".format(ex))
    base, existing, n_types, masking = None, {}, 0, None
    for rt in FilteredElementCollector(d).OfClass(DB.FilledRegionType):
        n_types += 1
        try:
            existing[unicode(rt.Name)] = rt
        except Exception:
            pass
        m = False
        try:
            m = bool(rt.IsMasking)
        except Exception:
            pass
        if base is None and not m:
            base = rt
        if masking is None:
            masking = rt
    if base is None:
        base = masking                                     # only a masking type is left: we try it
    if base is None:
        mk = getattr(DB.FilledRegionType, u"Create", None)
        if mk is not None:
            for args in ((d, DB.ElementId.InvalidElementId, u"TK Audit - Base"), (d, u"TK Audit - Base")):
                try:
                    base = mk(*args)
                    break
                except Exception:
                    pass
    if base is None or solid is None:
        raise Exception(u"no {}{}{} (Filled Region types: {}, fills: {}, solid: {})".format(
            u"Filled Region type" if base is None else u"", u" and " if base is None and solid is None else u"",
            u"solid fill" if solid is None else u"", n_types, n_pat, n_solid))
    spec = [(u"canvas", u"Canvas", (245, 245, 247)), (u"card", u"Card", (255, 255, 255)),
            (u"track", u"Bar Track", (229, 229, 234)), (u"ok", u"Bar OK", (52, 199, 89)),
            (u"warn", u"Bar Warn", (255, 149, 0)), (u"bad", u"Bar Bad", (255, 59, 48)),
            (u"blue", u"Bar Blue", (0, 122, 255)), (u"gray", u"Bar Gray", (199, 199, 204)),
            (u"dark", u"Header", (28, 28, 30))]
    out = {}
    for key, nm, c in spec:
        full = u"{} - {}".format(TK_RPT_PREFIX, nm)
        rt = existing.get(full)
        if rt is None:
            rt = tkx_rpt_dup(d, base, full)
        col = DB.Color(c[0], c[1], c[2])
        for attr, val in ((u"ForegroundPatternId", solid.Id), (u"ForegroundPatternColor", col),
                          (u"FillPatternId", solid.Id), (u"FillPatternColor", col),
                          (u"BackgroundPatternId", DB.ElementId.InvalidElementId)):
            try:
                setattr(rt, str(attr), val)
            except Exception:
                pass
        out[key] = rt.Id
    return out


def tkx_rpt_invisible_style(d):
    """The "<Invisible lines>" line style (in any localization), so that cards have no outline."""
    try:
        for gs in FilteredElementCollector(d).OfClass(DB.GraphicsStyle):
            try:
                n = unicode(gs.Name).lower()
                if (u"invisible" in n or u"\u043d\u0435\u0432\u0438\u0434\u0438\u043c" in n or u"\u043d\u0435\u0432\u0438\u0434\u0438\u043c" in n) and \
                        gs.GraphicsStyleType == DB.GraphicsStyleType.Projection:
                    return gs.Id
            except Exception:
                pass
    except Exception as ex:
        tk_log(u"report: GraphicsStyle collector: {}".format(ex))
    try:
        cat = d.Settings.Categories.get_Item(DB.BuiltInCategory.OST_Lines)
        for sc in cat.SubCategories:
            n = unicode(sc.Name).lower()
            if u"invisible" in n or u"\u043d\u0435\u0432\u0438\u0434\u0438\u043c" in n:
                return sc.GetGraphicsStyle(DB.GraphicsStyleType.Projection).Id
    except Exception as ex:
        tk_log(u"report: Invisible lines: {}".format(ex))
    return None


def tkx_rpt_rrect(x0, y0, x1, y1, r):
    """CurveLoop of a rounded rectangle (x0<x1, y0<y1, feet). r = corner radius."""
    tol = 0.0027                                           # Revit does not accept curves shorter than ~0.8 mm
    r = min(r, (x1 - x0) / 2.0, (y1 - y0) / 2.0)
    for dim in (x1 - x0, y1 - y0):                         # the straight segment between arcs is not shorter than tol (or they meet exactly at a point)
        if 1e-9 < dim - 2 * r < tol:
            r = (dim - tol) / 2.0

    def P(x, y):
        return DB.XYZ(x, y, 0.0)
    loop = DB.CurveLoop()
    if r < tol:
        pts = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
        for i in range(4):
            a, b = pts[i], pts[(i + 1) % 4]
            loop.Append(DB.Line.CreateBound(P(a[0], a[1]), P(b[0], b[1])))
        return loop
    k = 0.70710678 * r
    segs = [(u"L", (x0 + r, y0), (x1 - r, y0), None),
            (u"A", (x1 - r, y0), (x1, y0 + r), (x1 - r + k, y0 + r - k)),
            (u"L", (x1, y0 + r), (x1, y1 - r), None),
            (u"A", (x1, y1 - r), (x1 - r, y1), (x1 - r + k, y1 - r + k)),
            (u"L", (x1 - r, y1), (x0 + r, y1), None),
            (u"A", (x0 + r, y1), (x0, y1 - r), (x0 + r - k, y1 - r + k)),
            (u"L", (x0, y1 - r), (x0, y0 + r), None),
            (u"A", (x0, y0 + r), (x0 + r, y0), (x0 + r - k, y0 + r - k))]
    for kind, a, b, m in segs:
        if kind == u"L":
            if ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5 < tol:
                continue                                    # e.g. the sides of a "pill": the arcs touch
            loop.Append(DB.Line.CreateBound(P(a[0], a[1]), P(b[0], b[1])))
        else:
            loop.Append(DB.Arc.Create(P(a[0], a[1]), P(b[0], b[1]), P(m[0], m[1])))
    return loop


def tkx_rpt_est(text, width_mm, line_mm, cw_mm):
    cpl = max(8, int(width_mm / cw_mm))
    return sum(max(1, -(-len(ln) // cpl)) for ln in text.split(u"\n")) * line_mm


def tkx_rpt_build(d, view, res, fmt=u"full", sel=None):
    """Apple-style report: light gray background, white rounded cards, big numbers, bar charts,
    without truncating lists. The transaction is opened outside. Everything in mm (view 1:1). Returns (width, height, errors)."""
    sel = tkx_rpt_norm_sel(fmt, sel)

    def want(key, mode=1):
        return sel.get(key, 0) >= mode and tkx_item_avail(res, key)
    T = tkx_rpt_types(d)
    errs = {}

    def oops(what, ex):
        msg = u"{}: {}".format(what, err_text(ex))
        errs[msg] = errs.get(msg, 0) + 1
        tk_log(u"report {}\n{}".format(msg, traceback.format_exc()))
    try:
        RT = tkx_rpt_region_types(d)
    except Exception as ex:
        RT = None
        oops(u"Filled Region types", ex)
    inv = tkx_rpt_invisible_style(d) if RT is not None else None
    if RT is not None and inv is None:
        oops(u"line style", Exception(u"\"Invisible lines\" was not found in the model, card outlines will be visible"))
    M, IW, G, PAD = 14.0, 290.0, 6.0, 8.0
    RP, LP, BW, MAXR = 6.2, 5.4, 60.0, 120
    SIZE = dict((k, mm) for k, nm, mm, b, c in TK_RPT_TSPEC)
    KW = 0.7                                               # symbol width / size (Segoe UI, with a margin)

    def F(mm):
        return mm / 304.8

    def region(x0, ytop, x1, ybot, key, rad):
        if RT is None:                                     # fallback: card outlines only
            if key == u"card":
                try:
                    for cv in tkx_rpt_rrect(F(x0), F(ybot), F(x1), F(ytop), F(rad)):
                        d.Create.NewDetailCurve(view, cv)
                except Exception as ex:
                    oops(u"card outline", ex)
            return None
        try:
            loop = tkx_rpt_rrect(F(x0), F(ybot), F(x1), F(ytop), F(rad))
            fr = DB.FilledRegion.Create(d, RT[key], view.Id, List[DB.CurveLoop]([loop]))
        except Exception as ex:
            oops(u"fill \"{}\"".format(key), ex)
            return None
        if inv is not None:
            try:
                fr.SetLineStyleId(inv)
            except Exception as ex:
                oops(u"hide outline", ex)
        return fr

    def note(x, y, w, text, key):
        if not text:
            return None
        try:
            opts = DB.TextNoteOptions(T[key])
            opts.HorizontalAlignment = DB.HorizontalTextAlignment.Left
            opts.VerticalAlignment = DB.VerticalTextAlignment.Top
            return DB.TextNote.Create(d, view.Id, DB.XYZ(F(x), F(y), 0.0), F(w), text, opts)
        except Exception as ex:
            oops(u"text", ex)
            return None

    # --- calibration of the row height of each style (so the layout is deterministic)
    ptab = {}
    for key in SIZE:
        mm = SIZE[key]
        ptab[key] = (mm * 1.3, mm * 1.4)
        try:
            n1 = note(0.0, 0.0, 250.0, u"\u0410y", key)
            n5 = note(0.0, -60.0, 250.0, u"\u0410y\n\u0410y\n\u0410y\n\u0410y\n\u0410y", key)
            d.Regenerate()
            h1 = float(n1.Height) * 304.8
            h5 = float(n5.Height) * 304.8
            d.Delete(n1.Id)
            d.Delete(n5.Id)
            if h1 > 0.2 and (h5 - h1) / 4.0 > 0.2:
                ptab[key] = (h1, (h5 - h1) / 4.0)
        except Exception as ex:
            oops(u"text calibration", ex)

    def th(key, n=1):
        h1, p = ptab[key]
        return h1 + (max(1, n) - 1) * p

    def wrapw(par, cpl):
        out, cur = [], u""
        for w in par.split(u" "):
            while len(w) > cpl:
                if cur:
                    out.append(cur)
                    cur = u""
                out.append(w[:cpl])
                w = w[cpl:]
            if not cur:
                cur = w
            elif len(cur) + 1 + len(w) <= cpl:
                cur += u" " + w
            else:
                out.append(cur)
                cur = w
        out.append(cur)
        return out

    def wrapl(text, width_mm, key, maxl=None):
        cpl = max(8, int(width_mm / (SIZE[key] * KW)))
        out = []
        for para in unicode(text).split(u"\n"):
            out.extend(wrapw(para, cpl))
        if maxl and len(out) > maxl:
            out = out[:maxl - 1] + [tkx_short(u" ".join(out[maxl - 1:]), cpl)]
        return out

    def cap1(s):
        s = unicode(s or u"")
        return s[:1].upper() + s[1:]

    def lvkey(lv):
        return lv if lv in (u"ok", u"warn", u"bad") else u"gray"

    def dot(x, ytop, size, lv):
        region(x, ytop, x + size, ytop - size, lvkey(lv), size / 2.0)

    tiles_all = tkx_audit_tiles(res, None)
    tiles = [tl for tl in tiles_all if want(tl[0])]
    if not tiles:
        raise Exception(u"no items are selected for the report")
    hero, grid = None, []
    for tl in tiles:
        if tl[0] == u"filesize" and hero is None:
            hero = tl
        else:
            grid.append(tl)
    lvmap = dict((tl[0], tl[3]) for tl in tiles)
    cnt = {u"bad": 0, u"warn": 0, u"ok": 0, u"info": 0}
    for tl in tiles:
        cnt[tl[3]] = cnt.get(tl[3], 0) + 1

    if fmt == u"compact":
        CK = (u"filesize", u"imports", u"warnings", u"inplace", u"offsheet", u"groups", u"rooms", u"options", u"dups")
        CL = {u"filesize": u"File size, MB", u"imports": u"CAD imports", u"warnings": u"Revit warnings",
              u"inplace": u"In-place families", u"offsheet": u"Views not on sheets", u"groups": u"Model groups",
              u"rooms": u"Unplaced rooms", u"options": u"Design options", u"dups": u"Duplicate elements"}
        by_key = dict((tl[0], tl) for tl in tiles)
        order = list(CK) + [k for k, _c, _l in TK_RPT_ITEMS if k not in CK]
        citems = [by_key[k] for k in order if k in by_key]
        CW, CG, CP, HWD = 36.0, 2.5, 5.0, 46.0
        c_cap = 4.5
        c_num = c_cap + th(u"cap", 2) + 2.0
        c_gau = c_num + th(u"cm_val") + 3.0
        CH = c_gau + 2.0 + 5.0
        n = len(citems)
        W = CP + HWD + n * CW + (n - 1) * CG + CP
        Hh = CH + 2 * CP
        region(0.0, 0.0, W, -Hh, u"canvas", 5.0)
        hx = CP + 2.0
        note(hx, -CP - 2.0, HWD - 4.0, u"Model\nmetrics", u"ctitle")
        yy = -CP - 2.0 - th(u"ctitle", 2) - 3.0
        note(hx, yy, HWD - 4.0, u"Checked:\n" + time.strftime(u"%Y-%m-%d %H:%M", time.localtime(res[u"t"])), u"mini")
        yy -= th(u"mini", 2) + 3.0
        worst = u"bad" if cnt[u"bad"] else (u"warn" if cnt[u"warn"] else u"ok")
        dot(hx, yy - max(0.0, (th(u"mini") - 2.4) / 2.0), 2.4, worst)
        note(hx + 4.0, yy, HWD - 8.0, u"Action needed" if cnt[u"bad"] else (u"Room for improvement" if cnt[u"warn"] else u"All good"), u"mini")
        x0 = CP + HWD
        for i, (key, val, cap, lv, sub, fr) in enumerate(citems):
            x = x0 + i * (CW + CG)
            y0 = -CP
            region(x, y0, x + CW, y0 - CH, u"card", 3.5)
            note(x + 4.0, y0 - c_cap, CW - 8.0, u"\n".join(wrapl(CL.get(key, cap), CW - 8.0, u"cap", 2)), u"cap")
            vtxt = val.replace(u"\u2009", u"")
            note(x + 4.0, y0 - c_num, CW - 8.0, vtxt, {u"warn": u"cm_warn", u"bad": u"cm_bad"}.get(lv, u"cm_val"))
            dot(x + CW - 4.0 - 3.0, y0 - c_num - 2.0, 3.0, lv)
            if lv in (u"ok", u"warn", u"bad"):
                bx0, bx1 = x + 4.0, x + CW - 4.0
                region(bx0, y0 - c_gau, bx1, y0 - c_gau - 2.0, u"track", 1.0)
                if lv != u"ok" or fr > 0:
                    region(bx0, y0 - c_gau, bx0 + max(3.0, (bx1 - bx0) * fr), y0 - c_gau - 2.0, lv, 1.0)
        return F(W), F(Hh), sorted(errs.items(), key=lambda kv: -kv[1])

    flow = []                                              # [(height, draw(y) or None)]

    # ---------------------------------------------------------------- header
    meta = u"{}  \u00B7  {}  \u00B7  {:.1f} s".format(
        time.strftime(u"%Y-%m-%d %H:%M", time.localtime(res[u"t"])),
        u"deep audit" if res.get(u"deep") else u"quick audit", res.get(u"dur", 0))
    if res.get(u"cancelled"):
        meta += u"  \u00B7  cancelled, data incomplete"
    ex_l = []
    for x in res.get(u"notes", []):
        ex_l.extend(wrapl(x, 190.0, u"alert"))
    for x in res.get(u"err", []):
        ex_l.extend(wrapl(u"Step error \u2014 " + x, 190.0, u"alert"))
    hl = th(u"title") + 1.0 + th(u"lead") + 2.0 + th(u"cap")
    if ex_l:
        hl += 4.0 + th(u"alert", len(ex_l))
    hr = (th(u"cap") + 2.5 + th(u"metric") + 1.5 + th(u"mini")) if hero else 0.0

    def draw_header(y):
        yy = y
        note(0.0, yy, IW - 90.0, u"Model audit", u"title")
        yy -= th(u"title") + 1.0
        note(0.0, yy, IW - 90.0, tkx_short(res[u"doc"], 70), u"lead")
        yy -= th(u"lead") + 2.0
        note(0.0, yy, IW - 90.0, meta, u"cap")
        yy -= th(u"cap") + 4.0
        if ex_l:
            note(0.0, yy, IW - 90.0, u"\n".join(ex_l), u"alert")
        if hero:
            hx = IW - 72.0
            dot(hx, y - max(0.0, (th(u"cap") - 2.6) / 2.0), 2.6, hero[3])
            note(hx + 4.4, y, 66.0, cap1(hero[2]), u"cap")
            note(hx, y - th(u"cap") - 2.5, 70.0, hero[1], u"metric")
            note(hx, y - th(u"cap") - 2.5 - th(u"metric") - 1.5, 70.0, tkx_short(hero[4], 30), u"mini")
    flow.append((max(hl, hr), draw_header))
    flow.append((10.0, None))

    # ---------------------------------------------------------------- summary
    nb, nw, no, ni = cnt[u"bad"], cnt[u"warn"], cnt[u"ok"], cnt[u"info"]
    head = u"Action needed" if nb else (u"Room for improvement" if nw else u"All good")
    s_sub = u"Metrics checked: {}".format(len(tiles))
    h_sum = 7.0 + th(u"sec") + 1.0 + th(u"csub") + 6.0 + 3.4 + 5.0 + th(u"cap") + 7.0

    def draw_summary(y):
        region(0.0, y, IW, y - h_sum, u"card", 4.5)
        yy = y - 7.0
        note(PAD, yy, IW - 2 * PAD, head, u"sec")
        yy -= th(u"sec") + 1.0
        note(PAD, yy, IW - 2 * PAD, s_sub, u"csub")
        yy -= th(u"csub") + 6.0
        total = float(max(1, len(tiles)))
        parts = [(u"bad", nb), (u"warn", nw), (u"ok", no), (u"gray", ni)]
        parts = [(k, n) for k, n in parts if n > 0]
        full = IW - 2 * PAD - 1.0 * max(0, len(parts) - 1)
        sx = PAD
        for k, n in parts:
            wseg = max(3.0, full * n / total)
            region(sx, yy, sx + wseg, yy - 3.4, k, 1.2)
            sx += wseg + 1.0
        yy -= 3.4 + 5.0
        leg = [(u"bad", u"Critical", nb), (u"warn", u"Needs attention", nw), (u"ok", u"OK", no), (u"gray", u"Not rated", ni)]
        colw = (IW - 2 * PAD) / 4.0
        for i, (k, lab, n) in enumerate(leg):
            lx = PAD + i * colw
            region(lx, yy - max(0.0, (th(u"cap") - 2.4) / 2.0), lx + 2.4, yy - max(0.0, (th(u"cap") - 2.4) / 2.0) - 2.4, k, 1.2)
            note(lx + 4.0, yy, colw - 5.0, u"{}: {}".format(lab, n), u"cap")
    flow.append((h_sum, draw_summary))
    flow.append((G, None))

    # ---------------------------------------------------------------- metric tiles
    cap_y = 5.5
    num_y = cap_y + th(u"cap", 2) + 3.0
    sub_y = num_y + th(u"metric") + 1.5
    gau_y = sub_y + th(u"mini") + 3.5
    TH = gau_y + 2.2 + 6.0

    def make_row(items):
        tw = (IW - (len(items) - 1) * G) / float(len(items))

        def draw(y):
            for i, (key, val, cap, lv, sub, fr) in enumerate(items):
                x = i * (tw + G)
                region(x, y, x + tw, y - TH, u"card", 4.5)
                dot(x + PAD, y - cap_y - max(0.0, (th(u"cap") - 2.4) / 2.0), 2.4, lv)
                note(x + PAD + 4.2, y - cap_y, tw - 2 * PAD - 4.2, u"\n".join(wrapl(cap1(cap), tw - 2 * PAD - 4.2, u"cap", 2)), u"cap")
                note(x + PAD, y - num_y, tw - 2 * PAD, val, {u"warn": u"m_warn", u"bad": u"m_bad"}.get(lv, u"metric"))
                if sub:
                    note(x + PAD, y - sub_y, tw - 2 * PAD, tkx_short(sub, int((tw - 2 * PAD) / (SIZE[u"mini"] * KW))), u"mini")
                if lv in (u"ok", u"warn", u"bad"):
                    bx0, bx1 = x + PAD, x + tw - PAD
                    region(bx0, y - gau_y, bx1, y - gau_y - 2.2, u"track", 1.1)
                    if lv != u"ok" or fr > 0:
                        region(bx0, y - gau_y, bx0 + max(3.0, (bx1 - bx0) * fr), y - gau_y - 2.2, lv, 1.1)
        return draw
    for i in range(0, len(grid), 4):
        flow.append((TH, make_row(grid[i:i + 4])))
        flow.append((G, None))
    flow.append((6.0, None))

    # ---------------------------------------------------------------- details
    TTL = {u"warnings": u"Revit warnings", u"dups": u"Duplicate elements", u"inplace": u"In-place families",
           u"imports": u"Imported CAD", u"offsheet": u"Views not on sheets", u"groups": u"Model groups",
           u"rooms": u"Rooms", u"options": u"Design options", u"filters": u"Unused filters",
           u"templates": u"Unused view templates", u"patterns": u"Unused line patterns",
           u"views": u"Heaviest views", u"families": u"Largest families", u"clashes": u"Clashes",
           u"links": u"Revit links", u"unpinned": u"Unpinned levels and grids", u"emptysheets": u"Sheets without views",
           u"notemplate": u"Views on sheets without template", u"unusedfam": u"Unused families"}
    models = {}
    for key in TK_RPT_ORDER:
        if not want(key, 2):
            continue
        try:
            sub0, lines = tkx_audit_detail(res, key)
        except Exception as ex:
            oops(u"section \"{}\"".format(key), ex)
            continue
        lines = [x for x in lines if x is not None]
        rows, accent = None, u"blue"
        if key == u"warnings":
            rows, accent = [(n, t, u"") for t, n in res[u"warnings"][u"items"]], u"warn"
        elif key == u"groups":
            rows = [(k, n, u"") for n, k in res[u"groups"][u"items"]]
        elif key == u"inplace":
            rows = [(k, n, c) for n, c, k in res[u"inplace"][u"items"]]
        elif key == u"views" and res[u"views"].get(u"deep"):
            rows = [(n, nm + (u"  \u00B7  on a sheet" if on else u""), t) for nm, t, n, on in res[u"views"][u"items"]]
        elif key == u"families":
            rows = [(n, nm, c) for nm, c, n in res[u"families"][u"items"]]
        pre, items = [], []
        if rows is None:
            for x in lines:
                if not x:
                    continue
                (pre if x.startswith(u"By type") else items).append(x)
            if not items:
                continue
        elif not rows:
            continue
        models[key] = {u"title": TTL.get(key, key), u"sub": sub0, u"rows": rows, u"pre": pre, u"items": items,
                       u"accent": accent, u"lv": lvmap.get(key, u"info")}

    def plan_card(key, w):
        m = models[key]
        inner = w - 2 * PAD
        sub = wrapl(m[u"sub"], inner, u"csub", 3)
        head_h = 6.0 + th(u"ctitle") + 1.2 + th(u"csub", len(sub)) + 5.0
        rows, items, pre = m[u"rows"], m[u"items"], m[u"pre"]
        more, ncols, per, colw = 0, 1, 0, inner
        pre_l = []
        body_h = 0.0
        if rows is not None:
            if len(rows) > MAXR:
                more, rows = len(rows) - MAXR, rows[:MAXR]
            lab_w0 = inner - 17.0 - BW - 6.0
            rinfo = []
            for (v, label, tag) in rows:
                ll = wrapl(label + (u"  \u00B7  " + tag if tag else u""), lab_w0, u"row", 2)
                rinfo.append((v, ll, max(RP, th(u"row", len(ll)) + 2.4)))
            body_h = sum(r[2] for r in rinfo)
        else:
            if len(items) > MAXR:
                more, items = len(items) - MAXR, items[:MAXR]
            if pre:
                pre_l = wrapl(u"\n".join(pre), inner, u"cap")
                body_h += th(u"cap", len(pre_l)) + 3.5
            cw = SIZE[u"row"] * KW
            mx = max(len(x) for x in items)
            for c in (3, 2, 1):
                cwid = (inner - (c - 1) * 8.0) / c
                if c == 1 or mx * cw <= cwid:
                    ncols, colw = c, cwid
                    break
            ncols = min(ncols, max(1, -(-len(items) // 4)))
            colw = (inner - (ncols - 1) * 8.0) / ncols
            per = -(-len(items) // ncols)
            body_h += per * LP
        if more:
            body_h += 5.0
        h = head_h + body_h + 5.0

        def draw(x, y, hh):
            region(x, y, x + w, y - hh, u"card", 4.5)
            dot(x + PAD, y - 6.0 - max(0.0, (th(u"ctitle") - 2.6) / 2.0), 2.6, m[u"lv"])
            note(x + PAD + 5.0, y - 6.0, inner - 5.0, m[u"title"], u"ctitle")
            note(x + PAD, y - 6.0 - th(u"ctitle") - 1.2, inner, u"\n".join(sub), u"csub")
            by = y - head_h
            if rows is not None:
                vmax = float(max(1, max(r[0] for r in rinfo)))
                lab_w = inner - 17.0 - BW - 6.0
                ry = by
                for (v, ll, rh) in rinfo:
                    note(x + PAD, ry, 16.0, tkx_num(v), u"num")
                    L = max(2.2, BW * float(v) / vmax)
                    region(x + PAD + 17.0, ry - 1.0, x + PAD + 17.0 + L, ry - 3.2, m[u"accent"], 1.1)
                    note(x + PAD + 17.0 + BW + 6.0, ry, lab_w, u"\n".join(ll), u"row")
                    ry -= rh
                by = ry
            else:
                yy = by
                if pre_l:
                    note(x + PAD, yy, inner, u"\n".join(pre_l), u"cap")
                    yy -= th(u"cap", len(pre_l)) + 3.5
                cpl = int(colw / (SIZE[u"row"] * KW))
                for c in range(ncols):
                    for j, s in enumerate(items[c * per:(c + 1) * per]):
                        note(x + PAD + c * (colw + 8.0), yy - j * LP, colw, tkx_short(s, cpl), u"row")
                by = yy - per * LP
            if more:
                note(x + PAD, by, inner,
                     u"Showing {} items; {} more \u2014 in the copied report".format(MAXR, more), u"mini")
        return {u"h": h, u"draw": draw}

    def half_ok(key):
        m = models[key]
        if m[u"rows"] is not None or len(m[u"items"]) > 30:
            return False
        hw = (IW - G) / 2.0 - 2 * PAD
        return max(len(x) for x in m[u"items"]) * SIZE[u"row"] * KW <= hw

    rank = {u"bad": 0, u"warn": 1, u"ok": 2, u"info": 3}
    keys = sorted([k for k in TK_RPT_ORDER if k in models],
                  key=lambda k: (rank.get(models[k][u"lv"], 3), TK_RPT_ORDER.index(k)))
    att = [k for k in keys if models[k][u"lv"] in (u"bad", u"warn")]
    ref = [k for k in keys if k not in att]
    HW = (IW - G) / 2.0

    def sec_label(text):
        flow.append((th(u"sec"), lambda y, t=text: note(0.0, y, IW, t, u"sec")))
        flow.append((5.0, None))

    def emit_group(group):
        pend = []

        def flush_pend():
            if pend:
                k = pend.pop()
                p = plan_card(k, IW)
                flow.append((p[u"h"], lambda y, p=p: p[u"draw"](0.0, y, p[u"h"])))
                flow.append((G, None))
        for k in group:
            if half_ok(k):
                if pend:
                    a = plan_card(pend.pop(), HW)
                    b = plan_card(k, HW)
                    hh = max(a[u"h"], b[u"h"])

                    def dr(y, a=a, b=b, hh=hh):
                        a[u"draw"](0.0, y, hh)
                        b[u"draw"](HW + G, y, hh)
                    flow.append((hh, dr))
                    flow.append((G, None))
                else:
                    pend.append(k)
            else:
                flush_pend()
                p = plan_card(k, IW)
                flow.append((p[u"h"], lambda y, p=p: p[u"draw"](0.0, y, p[u"h"])))
                flow.append((G, None))
        flush_pend()
    if att:
        sec_label(u"Needs attention")
        emit_group(att)
        flow.append((8.0, None))
    if ref:
        sec_label(u"For reference")
        emit_group(ref)

    foot = u"Universal Toolkit  \u00B7  {}".format(time.strftime(u"%Y-%m-%d %H:%M", time.localtime(res[u"t"])))
    flow.append((th(u"foot"), lambda y: note(0.0, y, IW, foot, u"foot")))

    # ---------------------------------------------------------------- drawing: first the background, then all blocks top to bottom
    total = sum(h for h, fn in flow)
    region(-M, M, IW + M, -(total + M), u"canvas", 6.0)
    y = 0.0
    for h, fn in flow:
        if fn is not None:
            try:
                fn(y)
            except Exception as ex:
                oops(u"report block", ex)
        y -= h
    return F(IW + 2 * M), F(total + 2 * M), sorted(errs.items(), key=lambda kv: -kv[1])


def tkx_rpt_title_block(d):
    """The main sheet frame of the model's sheets (most common among the first sheets), otherwise the first available, otherwise None."""
    try:
        counts, k = {}, 0
        for sh in FilteredElementCollector(d).OfClass(DB.ViewSheet):
            k += 1
            if k > 80:
                break
            try:
                if sh.IsPlaceholder:
                    continue
                for tb in FilteredElementCollector(d, sh.Id).OfCategory(DB.BuiltInCategory.OST_TitleBlocks).WhereElementIsNotElementType():
                    tid = id_value(tb.GetTypeId())
                    counts[tid] = counts.get(tid, 0) + 1
            except Exception:
                pass
        if counts:
            best = max(counts.items(), key=lambda kv: kv[1])[0]
            el = d.GetElement(revit_id(best))
            if el is not None:
                return el
        for el in FilteredElementCollector(d).OfCategory(DB.BuiltInCategory.OST_TitleBlocks).WhereElementIsElementType():
            return el
    except Exception:
        pass
    return None


def tkx_rpt_uniq(name, taken):
    if name not in taken:
        return name
    i = 2
    while u"{} ({})".format(name, i) in taken:
        i += 1
    return u"{} ({})".format(name, i)


# ---------------------------------------------------------------------------
#  Revit schedules for the audit report (what lives in the model as real elements: they can be sorted, filtered, highlighted)
# ---------------------------------------------------------------------------
TK_RPT_SCHED_PREFIX = u"TK Audit - "


def tkx_rpt_sfield(d, sd, bips, names):
    """A schedulable field: first by BuiltInParameter (does not depend on the Revit language), then by name. None if absent."""
    want = set()
    for b in bips:
        bp = getattr(DB.BuiltInParameter, b, None)
        if bp is not None:
            try:
                want.add(int(bp))
            except Exception:
                pass
    low = set(unicode(n).strip().lower() for n in names)
    byname = None
    for f in sd.Definition.GetSchedulableFields():
        try:
            pid = f.ParameterId
            if want and pid is not None and id_value(pid) in want:
                return f
        except Exception:
            pass
        if byname is None and low:
            try:
                if unicode(f.GetName(d)).strip().lower() in low:
                    byname = f
            except Exception:
                pass
    return byname


def tkx_rpt_sfilter(fid, kind):
    SFT = DB.ScheduleFilterType
    if kind == u"hasno":
        return DB.ScheduleFilter(fid, SFT.HasNoValue)
    if kind == u"empty":
        return DB.ScheduleFilter(fid, SFT.Equal, u"")
    if kind == u"zero":
        return DB.ScheduleFilter(fid, SFT.Equal, 0.0)
    raise Exception(u"unknown filter " + unicode(kind))


def tkx_rpt_schedules(d, res, taken, stamp, which=None):
    """Creates the schedules INSIDE the report transaction. Every schedule has its own SubTransaction:
    a failure of one does not break the report or the others. Returns a list of dicts: name, rows, exp, notes, err, skipped."""
    rooms = res.get(u"rooms") or {}
    specs = [
        {u"key": u"offsheet", u"title": u"Views not on sheets",
         u"make": [lambda: DB.ViewSchedule.CreateViewList(d),
                   lambda: DB.ViewSchedule.CreateSchedule(d, DB.ElementId(DB.BuiltInCategory.OST_Views))],
         u"cols": [([u"VIEW_NAME"], [u"View Name", u"Name"], True),
                   ([u"ELEM_FAMILY_PARAM", u"VIEW_FAMILY"], [u"Family", u"View Type"], False),
                   ([u"VIEW_DISCIPLINE"], [u"Discipline"], False),
                   ([u"VIEWER_SHEET_NUMBER"], [u"Sheet Number"], False)],
         u"filters": [(3, [u"hasno", u"empty"])], u"sort": [1, 0],
         u"exp": (res.get(u"offsheet") or {}).get(u"n")},
        {u"key": u"rooms", u"title": u"Rooms not placed or not enclosed",
         u"make": [lambda: DB.ViewSchedule.CreateSchedule(d, DB.ElementId(DB.BuiltInCategory.OST_Rooms))],
         u"cols": [([u"ROOM_NUMBER"], [u"Number"], True),
                   ([u"ROOM_NAME"], [u"Name"], True),
                   ([u"ROOM_LEVEL_ID"], [u"Level"], False),
                   ([u"ROOM_AREA"], [u"Area"], True)],
         u"filters": [(3, [u"zero"])], u"sort": [0],
         u"exp": (rooms.get(u"n", 0) + rooms.get(u"unenclosed", 0)) if rooms else None},
    ]
    out = []
    for sp in specs:
        if which is not None and sp.get(u"key") not in which:
            continue
        e = {u"name": sp[u"title"], u"rows": None, u"exp": sp[u"exp"], u"notes": [], u"err": None, u"skipped": False}
        out.append(e)
        if sp[u"exp"] == 0:
            e[u"skipped"] = True
            continue
        st = DB.SubTransaction(d)
        st.Start()
        try:
            sd, last = None, None
            for mk in sp[u"make"]:
                try:
                    sd = mk()
                    if sd is not None:
                        break
                except Exception as ex_m:
                    last = ex_m
            if sd is None:
                raise Exception(u"the schedule could not be created ({})".format(err_text(last) if last else u"unsupported"))
            nm = tkx_rpt_uniq(u"{}{} {}".format(TK_RPT_SCHED_PREFIX, sp[u"title"], stamp), taken)
            taken.add(nm)
            sd.Name = nm
            e[u"name"] = nm
            fids = []
            for bips, names, req in sp[u"cols"]:
                f = tkx_rpt_sfield(d, sd, bips, names)
                fld = None
                if f is not None:
                    try:
                        fld = sd.Definition.AddField(f)
                    except Exception as ex_a:
                        tk_log(u"report schedule field: {}".format(ex_a))
                if fld is None and req:
                    raise Exception(u"the field \"{}\" was not found".format(names[0]))
                fids.append(fld)
            for ci, kinds in sp[u"filters"]:
                fld = fids[ci]
                if fld is None:
                    e[u"notes"].append(u"No column for the filter: the schedule shows all rows")
                    continue
                done, lasterr = False, None
                for kind in kinds:
                    try:
                        sd.Definition.AddFilter(tkx_rpt_sfilter(fld.FieldId, kind))
                        done = True
                        break
                    except Exception as ex_f:
                        lasterr = ex_f
                if not done:
                    e[u"notes"].append(u"The filter was not applied ({}): the schedule shows all rows".format(
                        err_text(lasterr) if lasterr else u"?"))
            for ci in sp[u"sort"]:
                if ci < len(fids) and fids[ci] is not None:
                    try:
                        sd.Definition.AddSortGroupField(DB.ScheduleSortGroupField(fids[ci].FieldId, DB.ScheduleSortOrder.Ascending))
                    except Exception as ex_s:
                        tk_log(u"report schedule sort: {}".format(ex_s))
            try:
                sd.Definition.IsItemized = True
            except Exception:
                pass
            try:
                d.Regenerate()
                e[u"rows"] = int(sd.GetTableData().GetSectionData(DB.SectionType.Body).NumberOfRows)
            except Exception as ex_r:
                tk_log(u"report schedule rows: {}".format(ex_r))
            st.Commit()
        except Exception as ex:
            try:
                st.RollBack()
            except Exception:
                pass
            e[u"err"] = err_text(ex)
            tk_log(u"report schedule '{}': {}\n{}".format(sp[u"title"], ex, traceback.format_exc()))
    return out


# ---------------------------------------------------------------------------
#  Action log on disk
# ---------------------------------------------------------------------------
def tkx_hist_load(n=TKX_LOG_SHOW):
    out = []
    try:
        if os.path.exists(TKX_ACTIONS_LOG):
            with open(TKX_ACTIONS_LOG, "rb") as f:
                raw = f.read()
            for ln in raw.decode("utf-8", "replace").splitlines()[-n:]:
                try:
                    out.append(json.loads(ln))
                except Exception:
                    pass
    except Exception as ex:
        tk_log(u"actions.log read: {}".format(ex))
    return out


def tkx_hist_write(rec):
    try:
        if not os.path.isdir(TKX_DIR):
            os.makedirs(TKX_DIR)
        row = {u"t0": rec[u"t0"], u"label": rec[u"label"], u"status": rec[u"status"], u"dur": round(rec.get(u"dur") or 0, 2),
               u"n": len(rec[u"commits"]), u"doc": rec[u"doc"], u"error": unicode(rec.get(u"error") or u"")[:300]}
        line = json.dumps(row) + "\n"
        data = line if isinstance(line, bytes) else line.encode("ascii")
        with open(TKX_ACTIONS_LOG, "ab") as f:
            f.write(data)
        if os.path.getsize(TKX_ACTIONS_LOG) > 200000:
            with open(TKX_ACTIONS_LOG, "rb") as f:
                lines = f.read().splitlines()
            with open(TKX_ACTIONS_LOG, "wb") as f:
                f.write(b"\n".join(lines[-TKX_LOG_KEEP:]) + b"\n")
    except Exception as ex:
        tk_log(u"actions.log write: {}".format(ex))


# ======================================================================
#  TKW: Workspaces (saved sets of open views) · Spotlight (search in the model) ·
#       Revit links (utk:// protocol)
# ======================================================================
from System.Windows import HorizontalAlignment as TkwHA
from Microsoft.Win32 import Registry as TkwRegistry
try:
    from urllib import quote as _tkw_quote, unquote as _tkw_unquote
except ImportError:
    from urllib.parse import quote as _tkw_quote, unquote as _tkw_unquote

TKW_WS_PATH = os.path.join(TKX_DIR, "workspaces.json")
TKW_LINK_DIR = os.path.join(TKX_DIR, "links")
TKW_LINK_VBS = os.path.join(TKW_LINK_DIR, "utk_open.vbs")
TKW_REG_KEY = u"Software\\Classes\\utk"
TKW_LINK_MAX_AGE = 600.0          # seconds: an older request (Toolkit was closed) is dropped
TKW_SP_MAX_ROOMS = 40000
TKW_SP_BUDGET = 25.0              # seconds for collecting the rooms
TKW_SP_PARAMS = [u"Unit", u"Unit Number", u"Unit No", u"\u042e\u043d\u0456\u0442"]
TKW_WEB_DEFAULT = u"https://universal-toolkit-omega.vercel.app"    # redirect page (utk_open.html): makes links clickable in chats
TKW_KINDS = (u"view", u"sheet", u"elem", u"room")
TKW_UID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-[0-9a-fA-F]{8}$")

TKW_VBS = u"""Option Explicit
Dim fso, dir, nm, f
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
If WScript.Arguments.Count > 0 Then
  nm = fso.GetTempName()
  nm = Left(nm, Len(nm) - 4)
  Set f = fso.CreateTextFile(dir & "\\" & nm & ".tmp", True, False)
  f.Write WScript.Arguments(0)
  f.Close
  fso.MoveFile dir & "\\" & nm & ".tmp", dir & "\\" & nm & ".req"
End If
""".replace(u"\n", u"\r\n")


def tkw_model_key(d):
    try:
        return unicode(d.ProjectInformation.UniqueId)
    except Exception:
        return unicode(d.Title)


# ---------------- workspaces: storage ----------------
def tkw_ws_load():
    d = _read_json(TKW_WS_PATH)
    if not isinstance(d, dict) or not isinstance(d.get(u"models"), dict):
        d = {u"v": 1, u"models": {}}
    return d


def tkw_ws_save(d):
    return _write_json(TKW_WS_PATH, d)


# ---------------- links ----------------
def tkw_q(s):
    return _tkw_quote(unicode(s).encode("utf-8"), safe="")


def tkw_uq(s):
    bs = bytearray()
    for part in re.split(u"(%[0-9A-Fa-f]{2})", unicode(s)):
        if len(part) == 3 and part[0] == u"%":
            bs.append(int(part[1:], 16))
        else:
            bs.extend(part.encode("utf-8"))
    return bytes(bs).decode("utf-8", "replace")


def tkw_link_build(mkey, title, kind, uid, name=u"", view_uid=u"", web_base=u""):
    q = u"m={}&t={}&k={}&u={}&n={}".format(tkw_q(mkey), tkw_q(title), kind, tkw_q(uid), tkw_q(name or u""))
    if view_uid:
        q += u"&v=" + tkw_q(view_uid)
    web_base = (web_base or u"").strip()
    if web_base:
        return web_base.split(u"#")[0].rstrip(u"?") + u"#" + q
    return u"utk://open?" + q


def tkw_link_parse(text):
    """Strict: only navigation requests of the known kinds with a valid UniqueId. Anything else -> None."""
    text = (text or u"").strip().lstrip(u"\ufeff")
    if not text.lower().startswith(u"utk://") or u"?" not in text:
        return None
    q = text.split(u"?", 1)[1].split(u"#")[0]
    d = {}
    for part in q.split(u"&"):
        if u"=" in part:
            k, v = part.split(u"=", 1)
            d[k] = tkw_uq(v)
    kind, uid = d.get(u"k", u""), d.get(u"u", u"")
    if kind not in TKW_KINDS or not TKW_UID_RE.match(uid):
        return None
    vu = d.get(u"v", u"")
    if vu and not TKW_UID_RE.match(vu):
        vu = u""
    return {u"m": d.get(u"m", u"")[:80], u"t": d.get(u"t", u"")[:120], u"k": kind, u"u": uid,
            u"n": d.get(u"n", u"")[:120], u"v": vu}


def tkw_cf_html(href, label):
    def esc(s):
        return s.replace(u"&", u"&amp;").replace(u"<", u"&lt;").replace(u">", u"&gt;").replace(u'"', u"&quot;")
    frag = u'<a href="{}">{}</a>'.format(esc(href), esc(label))
    pre = u"<html><body><!--StartFragment-->"
    post = u"<!--EndFragment--></body></html>"
    hdr = u"Version:0.9\r\nStartHTML:{0:010d}\r\nEndHTML:{1:010d}\r\nStartFragment:{2:010d}\r\nEndFragment:{3:010d}\r\n"
    hl = len(hdr.format(0, 0, 0, 0).encode("utf-8"))
    sf = hl + len(pre.encode("utf-8"))
    ef = sf + len(frag.encode("utf-8"))
    eh = ef + len(post.encode("utf-8"))
    return hdr.format(hl, eh, sf, ef) + pre + frag + post


def tkw_clip_link(href, label):
    """Plain text = the link; rich text = a hyperlink with a readable label (for Teams / Outlook)."""
    from System.Windows import DataObject, DataFormats
    for _ in range(6):
        try:
            dob = DataObject()
            dob.SetData(DataFormats.Html, tkw_cf_html(href, label))
            dob.SetData(DataFormats.UnicodeText, href)
            Clipboard.SetDataObject(dob, True)
            return True
        except Exception:
            time.sleep(0.05)
    return False


def tkw_reg_cmd():
    return u'wscript.exe //B //Nologo "{}" "%1"'.format(TKW_LINK_VBS)


def tkw_write_vbs():
    if not os.path.isdir(TKW_LINK_DIR):
        os.makedirs(TKW_LINK_DIR)
    try:
        if os.path.exists(TKW_LINK_VBS) and File.ReadAllText(TKW_LINK_VBS) == TKW_VBS:
            return
    except Exception:
        pass
    File.WriteAllText(TKW_LINK_VBS, TKW_VBS, System.Text.Encoding.Unicode)     # UTF-16 + BOM: any user name in the path


def tkw_reg_ok():
    try:
        k = TkwRegistry.CurrentUser.OpenSubKey(TKW_REG_KEY + u"\\shell\\open\\command")
        if k is None:
            return False
        v = k.GetValue(u"")
        k.Close()
        return unicode(v or u"") == tkw_reg_cmd() and os.path.exists(TKW_LINK_VBS)
    except Exception:
        return False


def tkw_reg_install():
    tkw_write_vbs()
    k = TkwRegistry.CurrentUser.CreateSubKey(TKW_REG_KEY)
    k.SetValue(u"", u"URL:Universal Toolkit Revit link")
    k.SetValue(u"URL Protocol", u"")
    k.Close()
    k = TkwRegistry.CurrentUser.CreateSubKey(TKW_REG_KEY + u"\\shell\\open\\command")
    k.SetValue(u"", tkw_reg_cmd())
    k.Close()


def tkw_reg_remove():
    TkwRegistry.CurrentUser.DeleteSubKeyTree(TKW_REG_KEY, False)


# ---------------- spotlight: index + search ----------------
def tkw_sp_probe(elements, pnames):
    """Which of the parameter names exist on the elements (a sample): the rest is not asked for every element."""
    found = []
    for el in elements:
        for pn in pnames:
            if pn in found:
                continue
            try:
                if el.LookupParameter(pn) is not None:
                    found.append(pn)
            except Exception:
                pass
        if len(found) == len(pnames):
            break
    return found


def tkw_sp_pvals(el, pnames):
    out = []
    for pn in pnames:
        try:
            p = el.LookupParameter(pn)
            if p is None or not p.HasValue:
                continue
            s = p.AsString() if p.StorageType == DB.StorageType.String else p.AsValueString()
            if s:
                out.append((pn, unicode(s)))
        except Exception:
            pass
    return out


def tkw_sp_collect(d, pnames):
    """Views, sheets, rooms of the model as light dicts. Runs in the Revit API context."""
    t0 = time.time()
    items = []
    sheet_no = {}
    on_sheet = {}
    try:
        for vp in FilteredElementCollector(d).OfClass(DB.Viewport):
            sid = id_value(vp.SheetId)
            if sid not in sheet_no:
                sh = d.GetElement(vp.SheetId)
                sheet_no[sid] = unicode(sh.SheetNumber) if sh is not None else u""
            on_sheet.setdefault(id_value(vp.ViewId), sheet_no[sid])
    except Exception as ex:
        tk_log(u"spot viewports: {}".format(ex))
    try:
        for si in FilteredElementCollector(d).OfClass(DB.ScheduleSheetInstance):
            sh = d.GetElement(si.OwnerViewId)
            if sh is not None:
                on_sheet.setdefault(id_value(si.ScheduleId), unicode(sh.SheetNumber))
    except Exception:
        pass
    views, sheets = [], []
    for v in FilteredElementCollector(d).OfClass(DB.View):
        try:
            if v.IsTemplate:
                continue
            vt = unicode(v.ViewType)
            if vt in (u"ProjectBrowser", u"SystemBrowser", u"Internal", u"Undefined"):
                continue
            if isinstance(v, DB.ViewSchedule):
                try:
                    if v.IsTitleblockRevisionSchedule or v.IsInternalKeynoteSchedule:
                        continue
                except Exception:
                    pass
            (sheets if isinstance(v, DB.ViewSheet) else views).append(v)
        except Exception:
            pass
    pv = tkw_sp_probe(views[:300], pnames)
    ps = tkw_sp_probe(sheets[:300], pnames)

    def add(kind, title, sub, uid, vals, extra):
        hay = u" ".join([title, sub, extra] + [x[1] for x in vals]).lower()
        items.append({u"t": title, u"tl": title.lower(), u"s": sub, u"k": kind, u"u": uid, u"h": hay, u"p": vals})
    for sh in sheets:
        try:
            num = unicode(sh.SheetNumber)
            add(u"sheet", u"{} - {}".format(num, sh.Name), u"sheet", sh.UniqueId, tkw_sp_pvals(sh, ps), num)
        except Exception:
            pass
    for v in views:
        try:
            lvl = u""
            try:
                g = v.GenLevel
                lvl = unicode(g.Name) if g is not None else u""
            except Exception:
                pass
            sn = on_sheet.get(id_value(v.Id), u"")
            sub = unicode(v.ViewType)
            if lvl:
                sub += u" \u00B7 " + lvl
            if sn:
                sub += u" \u00B7 " + sn
            add(u"view", unicode(v.Name), sub, v.UniqueId, tkw_sp_pvals(v, pv), lvl + u" " + sn)
        except Exception:
            pass
    truncated = False
    rooms = []
    try:
        col = FilteredElementCollector(d).OfCategory(DB.BuiltInCategory.OST_Rooms).WhereElementIsNotElementType()
        for r in col:
            if len(rooms) >= TKW_SP_MAX_ROOMS or time.time() - t0 > TKW_SP_BUDGET:
                truncated = True
                break
            try:
                if r.Area > 0:
                    rooms.append(r)
            except Exception:
                pass
    except Exception as ex:
        tk_log(u"spot rooms: {}".format(ex))
    pr = tkw_sp_probe(rooms[:200], pnames)
    for r in rooms:
        try:
            num = unicode(r.Number or u"")
            nm = r.get_Parameter(DB.BuiltInParameter.ROOM_NAME)
            nm = unicode(nm.AsString() or u"") if nm is not None else u""
            lvl = unicode(r.Level.Name) if r.Level is not None else u""
            add(u"room", (num + u" " + nm).strip(), (u"room \u00B7 " + lvl) if lvl else u"room", r.UniqueId,
                tkw_sp_pvals(r, pr), lvl)
        except Exception:
            pass
    return items, truncated


def tkw_sp_search(items, query, limit=30):
    variants = []
    for q in tkx_layouts(query):
        toks = [x for x in q.split() if x]
        if toks and toks not in variants:
            variants.append(toks)
    if not variants:
        return []
    res = []
    for it in items:
        h, tl = it[u"h"], it[u"tl"]
        best = None
        for toks in variants:
            sc = 0.0
            for tk in toks:
                if tk not in h:
                    sc = None
                    break
                sc += 50.0
                j = tl.find(tk)
                if j >= 0:
                    sc += 200.0 - min(j, 50)
                    if j == 0 or tl[j - 1] in u" -_/.:(\u00B7":
                        sc += 80.0
                    if len(tk) == len(tl):
                        sc += 300.0
            if sc is not None and (best is None or sc > best):
                best = sc
        if best is not None:
            res.append((best - len(tl) * 0.3, it))
    res.sort(key=lambda r: -r[0])
    return [it for _, it in res[:limit]]


TKX_PAL_XAML = u"""
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Toolkit: command palette" WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        Topmost="True" ShowInTaskbar="False" ResizeMode="NoResize" SizeToContent="Height" Width="620"
        WindowStartupLocation="Manual" UseLayoutRounding="True" SnapsToDevicePixels="True"
        FontFamily="Segoe UI Variable Text, Segoe UI, Arial" FontSize="13">
  <Window.Resources>
    <Style x:Key="PalThumb" TargetType="Thumb">
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Thumb">
            <Border x:Name="tb" CornerRadius="3" Background="#59808080"/>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter TargetName="tb" Property="Background" Value="#99808080"/>
              </Trigger>
              <Trigger Property="IsDragging" Value="True">
                <Setter TargetName="tb" Property="Background" Value="#CC808080"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style TargetType="ScrollBar">
      <Setter Property="Width" Value="10"/>
      <Setter Property="Background" Value="Transparent"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="ScrollBar">
            <Grid Background="Transparent">
              <Track x:Name="PART_Track" IsDirectionReversed="True">
                <Track.DecreaseRepeatButton>
                  <RepeatButton Command="ScrollBar.PageUpCommand" Focusable="False">
                    <RepeatButton.Template>
                      <ControlTemplate TargetType="RepeatButton"><Border Background="Transparent"/></ControlTemplate>
                    </RepeatButton.Template>
                  </RepeatButton>
                </Track.DecreaseRepeatButton>
                <Track.IncreaseRepeatButton>
                  <RepeatButton Command="ScrollBar.PageDownCommand" Focusable="False">
                    <RepeatButton.Template>
                      <ControlTemplate TargetType="RepeatButton"><Border Background="Transparent"/></ControlTemplate>
                    </RepeatButton.Template>
                  </RepeatButton>
                </Track.IncreaseRepeatButton>
                <Track.Thumb>
                  <Thumb Style="{StaticResource PalThumb}" Margin="2,2,2,2"/>
                </Track.Thumb>
              </Track>
            </Grid>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
  </Window.Resources>
  <Grid Margin="24">
    <Border CornerRadius="22" Padding="1.5">
      <Border.Background>
        <LinearGradientBrush StartPoint="0,0" EndPoint="1,0.4">
          <GradientStop Color="#0A84FF" Offset="0"/>
          <GradientStop Color="#BF5AF2" Offset="0.33"/>
          <GradientStop Color="#FF6482" Offset="0.66"/>
          <GradientStop Color="#FF9F0A" Offset="1"/>
        </LinearGradientBrush>
      </Border.Background>
      <Border.Effect>
        <DropShadowEffect BlurRadius="28" ShadowDepth="6" Opacity="0.35" Color="Black"/>
      </Border.Effect>
      <Border CornerRadius="20.5" Background="#141416">
        <StackPanel>
          <DockPanel Margin="18,12,18,0">
            <StackPanel DockPanel.Dock="Left" Orientation="Horizontal" VerticalAlignment="Center">
              <Border Width="20" Height="20" CornerRadius="6" Margin="0,0,8,0">
                <Border.Background>
                  <LinearGradientBrush StartPoint="0,0" EndPoint="1,1">
                    <GradientStop Color="#2997FF" Offset="0"/>
                    <GradientStop Color="#5E5CE6" Offset="1"/>
                  </LinearGradientBrush>
                </Border.Background>
                <Viewbox Width="14" Height="14">
                  <Grid Width="32" Height="32">
                    <Path Fill="#FFFFFF" Data="F0 M9,9 H15.8 C20,9 23,11.8 23,16 C23,20.2 20,23 15.8,23 H9 Z M12,11.8 V20.2 H15.6 C18.1,20.2 19.8,18.6 19.8,16 C19.8,13.4 18.1,11.8 15.6,11.8 Z"/>
                  </Grid>
                </Viewbox>
              </Border>
              <TextBlock Text="Datum Standards &amp; Command Lookup" FontSize="11.5" FontWeight="SemiBold" Foreground="#8E8E93" VerticalAlignment="Center"/>
            </StackPanel>
            <Border DockPanel.Dock="Right" CornerRadius="5" Background="#1F1F22" Padding="6,2" VerticalAlignment="Center">
              <TextBlock Text="ESC" FontSize="10" FontWeight="SemiBold" Foreground="#8E8E93"/>
            </Border>
            <Border/>
          </DockPanel>
          <Grid Margin="18,10,18,12">
            <TextBlock x:Name="palHint" Text="Search Datum standards, 3D assemblies, views or commands\u2026  (\u00AB>\u00BB = commands)" Foreground="#8E8E93" FontSize="14.5"
                       VerticalAlignment="Center" IsHitTestVisible="False"/>
            <TextBox x:Name="palQ" FontSize="15.5" Background="Transparent" BorderThickness="0" Foreground="#F5F5F7"
                     CaretBrush="#2997FF" VerticalAlignment="Center"/>
          </Grid>
          <Border Height="1" Background="#26FFFFFF"/>
          <ScrollViewer x:Name="palSv" Margin="0,0,4,0" MaxHeight="380" VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled">
            <StackPanel x:Name="palList" Margin="8,8,8,6"/>
          </ScrollViewer>
          <Border Height="1" Background="#26FFFFFF" Margin="0,2,0,0"/>
          <WrapPanel x:Name="palQuick" Margin="14,10,14,2"/>
          <TextBlock x:Name="palFoot" Margin="20,4,20,12" Foreground="#8E8E93" FontSize="11"
                     Text="\u2191\u2193 select  \u00B7  Enter go  \u00B7  Shift+Enter copy link  \u00B7  Esc close"/>
        </StackPanel>
      </Border>
    </Border>
  </Grid>
</Window>
"""


class TkxMixin(object):
    """Methods added to PrintSetWindow (see the end of the block)."""

    # ------------------------------------------------------------------ setup
    def tkx_setup(self):
        self._tkx_log = []            # entries of this session (old -> new)
        self._tkx_hist = tkx_hist_load()
        self._tkx_stacks = {}         # document -> change stack: the tool record or None (someone else's change)
        self._tkx_cur = None
        self._tkx_last_err = None
        self._tkx_audit = tkx_audit_load()        # the last result stays on Home until a new audit is run
        self._tkx_sel = None
        self._tkx_hl = None           # highlight made by a click on an audit row (to restore the view)
        _sd = bool(self.settings.get("rpt_sched", True))            # the old single switch: the default of each schedule
        _ss = self.settings.get("rpt_scheds")
        _sl = self.settings.get("rpt_sel")
        self._tkx_rpt = {u"fmt": self.settings.get("rpt_fmt", u"full"), u"where": self.settings.get("rpt_where", u"sheet"),
                         u"scheds": dict((k, bool((_ss or {}).get(k, _sd)) if isinstance(_ss, dict) else _sd) for k, t in TK_RPT_SCHEDS),
                         u"sel": {u"full": tkx_rpt_norm_sel(u"full", (_sl or {}).get(u"full") if isinstance(_sl, dict) else None),
                                  u"compact": tkx_rpt_norm_sel(u"compact", (_sl or {}).get(u"compact") if isinstance(_sl, dict) else None)},
                         u"note": []}
        _ds = self.settings.get("deep_sel")
        _dsel = {}
        for _r in TKX_DEEP_STAGES:
            _dsel[_r[0]] = bool(_ds.get(_r[0], True)) if isinstance(_ds, dict) else True
        self._tkx_deep = {u"sel": _dsel, u"note": []}
        self._tkx_pal = None
        self._tkx_pal_ready = False
        self._tkx_ev_ok = False
        self._tkx_audit_dirty = True
        self._tkx_log_dirty = True
        self._tkx_hk_timer = None
        self._tkx_hk_down = False
        for n in (u"pnlAuditBtns pnlAuditTiles cardAuditDetail tbAuditStatus tbAuditDetailTitle tbAuditDetail pnlAuditRows pnlAuditDetailBtns "
                  u"gridAuditProg barAuditFill tbLogEmpty pnlLog pnlToolkitChips pnlHomeErr cardRptOpts pnlRptOpts cardDeepOpts pnlDeepOpts").split():
            setattr(self, n, self.win.FindName(n))
        if self.pnlLog is None:
            tk_log(u"tkx: the Home panel was not found in the XAML - disabled")
            return
        self.handler.on_begin = self.tkx_on_begin
        self.handler.on_end = self.tkx_on_end
        try:
            self._tkx_dc = self.tkx_doc_changed
            uiapp.Application.DocumentChanged += self._tkx_dc
            self._tkx_ev_ok = True
        except Exception as ex:
            tk_log(u"tkx: DocumentChanged is unavailable (Undo disabled): {}".format(ex))
        self.pnlAuditBtns.Children.Add(self.home_chip(u"Run audit", u"\uE72C", self.tkx_audit_start, accent=True,
                                                      tip=u"Quick audit without iterating over views. Read-only: the model is not changed"))
        self.pnlAuditBtns.Children.Add(self.home_chip(u"", u"\uE9D9", self.tkx_deep_card_toggle,
                                                      tip=u"Deep audit: choose what to run (clashes, every view, all families...), no time limit. Esc cancels and keeps what was collected"))
        try:
            _b = int(self.settings.get("audit_budget", TKX_BUDGET))
        except Exception:
            _b = int(TKX_BUDGET)
        self._tkx_budget_chip = self.home_chip(u"{} s".format(_b), u"\uE916", self.tkx_budget_cycle,
                                               tip=u"Time limit for the heaviest step of the quick audit (click: 30 / 60 / 120 / 300 s)")
        self.pnlAuditBtns.Children.Add(self._tkx_budget_chip)
        self.pnlAuditBtns.Children.Add(self.home_chip(u"", u"\uE8C8", self.tkx_audit_copy, tip=u"Copy the audit report"))
        self.pnlAuditBtns.Children.Add(self.home_chip(u"", u"\uE8A5", self.tkx_report_model_start,
                                                      tip=u"Report to model: a sheet, legend or drafting view, plus Revit schedules. Changes the model; undone with one Undo"))
        self.pnlToolkitChips.Children.Add(self.home_chip(u"Palette  Ctrl+K", u"\uE721", self.tkx_palette_open))
        self.pnlToolkitChips.Children.Add(self.home_chip(u"Datum: Sign in", u"\uE77B", self.tkx_datum_open_login))
        self.pnlToolkitChips.Children.Add(self.home_chip(u"Datum 3D Assemblies", u"\uE81E", lambda: datum_open_url(u"/?view=3d")))
        self.pnlToolkitChips.Children.Add(self.home_chip(u"Datum Detail Wall", u"\uE8B9", lambda: datum_open_url(u"/?view=wall")))
        self.pnlToolkitChips.Children.Add(self.home_chip(u"Export settings", u"\uE898", self.tkx_export_settings))
        self.pnlToolkitChips.Children.Add(self.home_chip(u"Import settings", u"\uE896", self.tkx_import_settings))
        try:
            self.tkx_datum_refresh_badge()
            btn_da = self.win.FindName(u"btnDatumAuth")
            if btn_da is not None:
                btn_da.MouseLeftButtonUp += lambda s, e: (setattr(e, "Handled", True), self.tkx_datum_open_login())
            for _nm, _fn, _bg, _hv in (
                (u"btnHdrSearch", self.tkx_palette_open, u"#161618", u"#222225"),
                (u"btnDatumHeroAsk", self.tkx_palette_open, None, None),
                (u"btnDatumNavLookup", self.tkx_palette_open, u"#00000000", u"#1F1F22"),
                (u"btnDatumNav3D", lambda: datum_open_url(u"/?view=3d"), u"#00000000", u"#1F1F22"),
                (u"btnDatumNavWall", lambda: datum_open_url(u"/?view=wall"), u"#00000000", u"#1F1F22"),
                (u"btnDatumNavKb", lambda: datum_open_url(u"/"), u"#00000000", u"#1F1F22"),
                (u"btnFeatLookup", self.tkx_palette_open, u"#141416", u"#1C1C1E"),
                (u"btnFeat3D", lambda: datum_open_url(u"/?view=3d"), u"#141416", u"#1C1C1E"),
                (u"btnFeatWall", lambda: datum_open_url(u"/?view=wall"), u"#141416", u"#1C1C1E"),
                (u"btnDatumSideUser", self.tkx_datum_open_login, u"#1C1C1E", u"#26262A"),
                (u"btnDatumBrand", lambda: setattr(self.tabHome, "IsChecked", True), None, None),
            ):
                _el = self.win.FindName(_nm)
                if _el is not None:
                    _el.MouseLeftButtonUp += (lambda s, e, cb=_fn: (setattr(e, "Handled", True), cb()))
                    if _hv is not None:
                        _el.MouseEnter += (lambda s, e, b=_hv: setattr(s, "Background", isl_brush(b)))
                        _el.MouseLeave += (lambda s, e, b=_bg: setattr(s, "Background", Brushes.Transparent if b == u"#00000000" else isl_brush(b)))
        except Exception as ex:
            tk_log(u"datum header setup: {}".format(ex))
        self.win.PreviewKeyDown += self.tkx_on_key
        self.win.Closed += lambda s, e: self.tkx_shutdown()
        self.tkx_hotkey_start()
        try:
            self.tkx_wl_setup()
        except Exception as ex:
            tk_log(u"tkx: workspaces/links setup: {}\n{}".format(ex, traceback.format_exc()))
        tk_log(u"tkx: setup done (events={})".format(self._tkx_ev_ok))

    def tkx_datum_refresh_badge(self):
        try:
            cfg = datum_get_cfg()
            usr = (cfg.get(u"user") or u"").strip()
            role = (cfg.get(u"role") or u"Member").strip()
            tb = self.win.FindName(u"tbDatumAuth")
            tb_title = self.win.FindName(u"tbDatumUserTitle")
            tb_sub = self.win.FindName(u"tbDatumUserSub")
            tb_av = self.win.FindName(u"tbDatumAvatar")
            if usr:
                short = usr.split(u"@")[0]
                initials = u"".join([p[0].upper() for p in short.replace(u".", u" ").replace(u"_", u" ").split()[:2]]) or short[:2].upper()
                if tb is not None:
                    tb.Text = short
                if tb_title is not None:
                    tb_title.Text = short
                if tb_sub is not None:
                    tb_sub.Text = u"{} · Connected".format(role)
                if tb_av is not None:
                    tb_av.Text = initials
            else:
                if tb is not None:
                    tb.Text = u"Sign in"
                if tb_title is not None:
                    tb_title.Text = u"Sign in to Datum"
                if tb_sub is not None:
                    tb_sub.Text = u"Sync standards & 3D nodes"
                if tb_av is not None:
                    tb_av.Text = u"DT"
        except Exception as ex:
            tk_log(u"tkx_datum_refresh_badge: {}".format(ex))

    def tkx_datum_open_login(self):
        try:
            hwnd = WindowInteropHelper(self.win).Handle if self.win is not None else None
        except Exception:
            hwnd = None
        datum_open_login_dialog(hwnd, on_done=lambda u: self.tkx_datum_refresh_badge())

    def tkx_shutdown(self):
        try:
            self.tkx_wl_shutdown()
        except Exception:
            pass
        try:
            if self._tkx_hk_timer is not None:
                self._tkx_hk_timer.Stop()
        except Exception:
            pass
        try:
            self.tkx_palette_close()
        except Exception:
            pass
        try:
            uiapp.Application.DocumentChanged -= self._tkx_dc
        except Exception as ex:
            tk_log(u"tkx: unsubscribe: {}".format(ex))

    def tkx_later(self, fn, ms=80):
        t = DispatcherTimer()
        t.Interval = TimeSpan.FromMilliseconds(ms)

        def tick(s, e):
            t.Stop()
            try:
                fn()
            except Exception as ex:
                tk_log(u"tkx_later: {}".format(ex))
        t.Tick += tick
        t.Start()

    # ------------------------------------------------- Handler: action log + Undo
    def tkx_on_begin(self, key, func, uiapp_):
        meta = getattr(func, "_tkx_meta", None)
        if meta is None:
            meta = TKX_FN_LABELS.get(getattr(func, "__name__", u""))
        if meta is None and key == "toolsact" and self.tools_job == "snapmarkers":
            meta = (u"Align Elevation markers", False)
        if meta is None:
            meta = TKX_KEY_LABELS.get(key)
        if meta is None:
            return None
        label, wrap = meta
        d = None
        try:
            ad = uiapp_.ActiveUIDocument
            d = ad.Document if ad else None
        except Exception:
            pass
        rec = {u"label": label, u"key": key, u"t0": time.time(), u"status": u"run", u"commits": [], u"undone": False,
               u"doc": unicode(d.Title) if d is not None else u"", u"error": None, u"tb": None}
        self._tkx_cur = rec
        if wrap and self._tkx_ev_ok and d is not None:
            try:
                if not d.IsFamilyDocument and not d.IsModifiable:
                    tg = TransactionGroup(d, u"Universal Toolkit: " + label)
                    if tg.Start() == TransactionStatus.Started:
                        rec[u"_tg"] = tg
            except Exception as ex:
                tk_log(u"tkx: the group did not start: {}".format(ex))
        return rec

    def tkx_on_end(self, rec, err, tb, uiapp_):
        tg = rec.pop(u"_tg", None)
        if tg is not None:
            try:
                if tg.GetStatus() == TransactionStatus.Started:
                    try:
                        tg.Assimilate()       # all changes of an action merge into one Undo step named after the action
                    except Exception as ex1:
                        tk_log(u"tkx: Assimilate: {} -> RollBack of the empty group".format(ex1))
                        try:
                            tg.RollBack()
                        except Exception:
                            pass
            except Exception as ex:
                tk_log(u"tkx: group completion: {}".format(ex))
        self._tkx_cur = None          # only after Assimilate: its events belong to this action too
        rec[u"dur"] = time.time() - rec[u"t0"]
        if err is None:
            rec[u"status"] = u"ok"
        else:
            rec[u"status"] = u"cancel" if isinstance(err, (Cancelled, OperationCanceledException)) else u"error"
            if rec[u"status"] == u"error":
                rec[u"error"] = err_text(err)
                rec[u"tb"] = tb
                rec[u"env"] = tkx_env_lines(uiapp_)
                self._tkx_last_err = rec
        self._tkx_log.append(rec)
        del self._tkx_log[:-60]
        tkx_hist_write(rec)
        self._tkx_log_dirty = True
        if rec[u"status"] == u"error" and self.tab != 4:
            self.hdr_toast(u"Error \u00B7 Ctrl+K \u2192 \"Copy error report\"")
        if self.tab == 4:
            self.tkx_home_render()

    def note_error(self, where, ex, tb):
        """WPF handler errors (tk_trace): we remember them for the report."""
        rec = {u"label": where, u"t0": time.time(), u"status": u"error", u"commits": [], u"undone": False,
               u"doc": u"", u"error": err_text(ex), u"tb": tb, u"env": tkx_env_lines(), u"key": None, u"dur": 0.0}
        self._tkx_last_err = rec
        self._tkx_log_dirty = True
        if self.tab != 4:
            self.hdr_toast(u"Error \u00B7 Ctrl+K \u2192 \"Copy error report\"")

    def tkx_doc_changed(self, sender, args):
        """We count Undo steps: who made the last change in the model - the tool or the user.
        The handler must be very light (every transaction calls it, including quick annotation placement)."""
        try:
            if self.closed:
                return
            op = unicode(args.Operation)
            self._tkx_sp_dirty = True
            d = args.GetDocument()
            key = unicode(d.Title) if d is not None else u""
            st = self._tkx_stacks.setdefault(key, [])
            cur = self._tkx_cur
            if op == u"TransactionCommitted":
                if cur is not None and cur.get(u"doc") == key:
                    try:
                        cur[u"commits"].extend([unicode(n) for n in args.GetTransactionNames()] or [u"?"])
                    except Exception:
                        cur[u"commits"].append(u"?")
                    if not st or st[-1] is not cur:
                        st.append(cur)
                else:
                    st.append(None)
            elif op == u"TransactionUndone":
                if st:
                    top = st.pop()
                    if top is not None:
                        top[u"undone"] = True
                        self._tkx_need_reindex = True
                self.tkx_schedule()
            elif op == u"TransactionRedone":
                st.append(None)
            del st[:-200]
            self._tkx_log_dirty = True
            if cur is None and self.tab == 4:
                self.tkx_schedule()
        except Exception as ex:
            tk_log(u"tkx_doc_changed: {}".format(ex))

    def tkx_schedule(self):
        """One deferred Home redraw per batch of events (not a timer per transaction)."""
        if getattr(self, "_tkx_pending", False):
            return
        self._tkx_pending = True
        self.tkx_later(self.tkx_flush, 300)

    def tkx_flush(self):
        self._tkx_pending = False
        if self.closed:
            return
        if getattr(self, "_tkx_need_reindex", False):
            self._tkx_need_reindex = False
            self.request_reindex()        # after Undo of our actions the sets/sheets cache may be stale
        self.tkx_home_render()

    def tkx_can_undo(self, rec):
        try:
            if rec.get(u"old") or rec.get(u"undone") or rec[u"status"] not in (u"ok", u"error") or not rec[u"commits"]:
                return False
            ad = uiapp.ActiveUIDocument
            if ad is None or unicode(ad.Document.Title) != rec[u"doc"]:
                return False
            st = self._tkx_stacks.get(rec[u"doc"]) or []
            return bool(st) and st[-1] is rec
        except Exception:
            return False

    def tkx_undo(self, rec):
        if not self.tkx_can_undo(rec):
            self.hdr_toast(u"After this action there were other changes in the model \u2014 Undo disabled")
            self.tkx_home_render()
            return

        def work(ua):
            ua.PostCommand(RevitCommandId.LookupPostableCommandId(PostableCommand.Undo))
        self.run(work, "tkx_undo")
        self.hdr_toast(u"Undoing: {}\u2026".format(rec[u"label"]))

    # ------------------------------------------------------------ Home: render
    def tkx_home_render(self):
        if self.pnlLog is None:
            return
        try:
            if self._tkx_audit_dirty:
                self._tkx_audit_dirty = False
                self.tkx_audit_render()
            if self._tkx_log_dirty:
                self._tkx_log_dirty = False
                self.tkx_log_render()
            self.tkx_err_render()
            self.tkx_ws_render()
        except Exception as ex:
            tk_log(u"tkx_home_render: {}\n{}".format(ex, traceback.format_exc()))

    def tkx_mini(self, text, glyph, action, tip=None, warn=False):
        bg, hv = u"#2C2C2E", u"#3A3A3C"
        bd = Border()
        bd.CornerRadius = CornerRadius(13)
        bd.Height = 26.0
        bd.Padding = Thickness(10, 0, 10, 0)
        bd.Margin = Thickness(6, 0, 0, 0)
        bd.Cursor = AnnCursors.Hand
        bd.Background = isl_brush(bg)
        if tip:
            bd.ToolTip = tip
        sp = StackPanel()
        sp.Orientation = Orientation.Horizontal
        ic = TextBlock()
        ic.Text = glyph
        ic.FontFamily = ICON_FONT
        ic.FontSize = 12.0
        ic.Foreground = isl_brush(u"#FFD479" if warn else u"#F5F5F7")
        ic.VerticalAlignment = VerticalAlignment.Center
        ic.Margin = Thickness(0, 0, 6, 0)
        sp.Children.Add(ic)
        tb = TextBlock()
        tb.Text = text
        tb.FontSize = 11.5
        tb.FontWeight = FontWeights.SemiBold
        tb.Foreground = isl_brush(u"#F5F5F7")
        tb.VerticalAlignment = VerticalAlignment.Center
        sp.Children.Add(tb)
        bd.Child = sp
        bd.MouseEnter += lambda s, e: setattr(bd, "Background", isl_brush(hv))
        bd.MouseLeave += lambda s, e: setattr(bd, "Background", isl_brush(bg))
        bd.MouseLeftButtonUp += lambda s, e: (setattr(e, "Handled", True), action())
        return bd

    def tkx_text(self, text, size, hexcol, bold=False, margin=None):
        tb = TextBlock()
        tb.Text = text
        tb.FontSize = size
        tb.Foreground = isl_brush(hexcol)
        if bold:
            tb.FontWeight = FontWeights.SemiBold
        tb.TextTrimming = TextTrimming.CharacterEllipsis
        if margin is not None:
            tb.Margin = margin
        return tb

    # ---- log
    def tkx_log_row(self, rec):
        old = rec.get(u"old", False)
        bd = Border()
        bd.CornerRadius = CornerRadius(14)
        bd.Padding = Thickness(12, 8, 8, 8)
        bd.Margin = Thickness(0, 0, 8, 6)
        bd.Background = isl_brush(u"#1C1C1E")
        dock = DockPanel()
        right = StackPanel()
        right.Orientation = Orientation.Horizontal
        right.VerticalAlignment = VerticalAlignment.Center
        DockPanel.SetDock(right, Dock.Right)
        dock.Children.Add(right)
        left = StackPanel()
        l1 = StackPanel()
        l1.Orientation = Orientation.Horizontal
        l1.Children.Add(self.tkx_text(time.strftime(u"%H:%M", time.localtime(rec[u"t0"])), 11.5, u"#8E8E93",
                                      margin=Thickness(0, 0, 8, 0)))
        l1.Children.Add(self.tkx_text(rec[u"label"], 13, u"#F5F5F7", bold=True))
        left.Children.Add(l1)
        st = rec[u"status"]
        n = len(rec[u"commits"]) if not old else rec.get(u"n", 0)
        short_doc = tkx_short(rec.get(u"doc") or u"", 26)
        if rec.get(u"undone"):
            txt, col = u"undone (Undo)", u"#FFD479"
        elif st == u"error":
            txt, col = u"error: " + tkx_short(rec.get(u"error"), 70), u"#FF6B6B"
        elif st == u"cancel":
            txt, col = u"cancelled by the user", u"#8E8E93"
        else:
            bits = [u"{:.1f} s".format(rec.get(u"dur") or 0), (u"model changes: {}".format(n) if n else u"no model changes")]
            if short_doc:
                bits.append(short_doc)
            txt, col = u"  \u00B7  ".join(bits), u"#8E8E93"
        left.Children.Add(self.tkx_text(txt, 11, col))
        dock.Children.Add(left)
        if not old:
            if self.tkx_can_undo(rec):
                right.Children.Add(self.tkx_mini(u"Undo", u"\uE7A7", lambda r=rec: self.tkx_undo(r),
                                                 tip=u"Undo this action in one Undo step (available while the model has had no other changes)"))
            if st == u"error":
                right.Children.Add(self.tkx_mini(u"Report", u"\uE8C8", lambda r=rec: self.tkx_copy_report(r),
                                                 tip=u"Copy error report"))
        if rec.get(u"commits"):
            bd.ToolTip = u"\n".join(rec[u"commits"][:12])
        bd.Child = dock
        return bd

    def tkx_log_render(self):
        p = self.pnlLog
        p.Children.Clear()
        rows = list(reversed(self._tkx_log))[:TKX_LOG_SHOW]
        if len(rows) < TKX_LOG_SHOW:
            for h in reversed(self._tkx_hist):
                if len(rows) >= TKX_LOG_SHOW:
                    break
                h = dict(h)
                h[u"old"] = True
                h.setdefault(u"commits", [])
                rows.append(h)
        for r in rows:
            p.Children.Add(self.tkx_log_row(r))
        self.tbLogEmpty.Visibility = Visibility.Collapsed if rows else Visibility.Visible

    # ---- "Error report" button under the status
    def tkx_err_render(self):
        p = self.pnlHomeErr
        if p is None:
            return
        p.Children.Clear()
        rec = self._tkx_last_err
        if rec is not None and not rec.get(u"copied"):
            p.Children.Add(self.home_chip(u"Copy error report", u"\uE8C8", lambda r=rec: self.tkx_copy_report(r),
                                          tip=u"Traceback, Revit version, document, active view, log tail"))

    def tkx_copy_report(self, rec=None):
        rec = rec or self._tkx_last_err
        if rec is None:
            self.hdr_toast(u"There were no errors in this session")
            return
        ok = tkx_clip_set(tkx_report_text(rec))
        if ok:
            rec[u"copied"] = True
        self.hdr_toast(u"Report copied \u2014 paste it into a chat or email" if ok else u"Could not copy: the clipboard is busy")
        self.tkx_err_render()

    # ------------------------------------------------------------ Audit: UI
    def tkx_audit_start(self, deep=False):
        if getattr(self, "_tkx_audit_busy", False):
            return
        if getattr(self, "_print_busy", False):
            self.hdr_toast(u"Printing is in progress: run the audit after it finishes")
            return
        self._tkx_audit_deep_req = bool(deep)
        self.prog_begin(1000, u"Deep audit" if deep else u"Audit", pct=True, audit=True)
        self.tkx_prog_set(u"starting\u2026", 0.0, None, deep)
        self.run(self.tkx_do_audit_deep if deep else self.tkx_do_audit, "tkx_audit")

    def tkx_audit_start_deep(self):
        self.tkx_audit_start(True)

    # ------------------------------------------------------------ Deep audit: choose what to run
    def tkx_deep_only(self):
        """The set of stages to run in the Deep audit; None = all of them."""
        sel = self._tkx_deep[u"sel"]
        on = set(k for k, v in sel.items() if v)
        return None if len(on) >= len(TKX_DEEP_STAGES) else on

    def tkx_deep_card_toggle(self):
        if self.cardDeepOpts is None:
            self.tkx_audit_start(True)
            return
        if self.cardDeepOpts.Visibility == Visibility.Visible:
            self.cardDeepOpts.Visibility = Visibility.Collapsed
            return
        if self.cardRptOpts is not None:
            self.cardRptOpts.Visibility = Visibility.Collapsed
        self._tkx_deep[u"note"] = []
        self.tkx_deep_render()
        self.cardDeepOpts.Visibility = Visibility.Visible

    def tkx_deep_close(self):
        self.cardDeepOpts.Visibility = Visibility.Collapsed

    def tkx_deep_save(self):
        try:
            self.settings["deep_sel"] = dict(self._tkx_deep[u"sel"])
            save_settings(self.settings)
        except Exception as ex:
            tk_log(u"tkx_deep_save: {}".format(ex))

    def tkx_deep_toggle(self, key):
        sel = self._tkx_deep[u"sel"]
        sel[key] = not sel.get(key, True)
        self._tkx_deep[u"note"] = []
        self.tkx_deep_save()
        self.tkx_deep_render()

    def tkx_deep_preset(self, which):
        sel = self._tkx_deep[u"sel"]
        for key, pk, cap, hint, cost, deep_only in TKX_DEEP_STAGES:
            if which == u"all":
                sel[key] = True
            elif which == u"none":
                sel[key] = False
            else:                                      # "extra": what the quick audit does not do (or does only partly)
                sel[key] = bool(deep_only or key in (u"families", u"patterns"))
        self._tkx_deep[u"note"] = []
        self.tkx_deep_save()
        self.tkx_deep_render()

    def tkx_deep_run(self):
        if not any(self._tkx_deep[u"sel"].values()):
            self._tkx_deep[u"note"] = [(u"Select at least one item in the list above.", u"warn")]
            self.tkx_deep_render()
            return
        self.tkx_deep_save()
        self.cardDeepOpts.Visibility = Visibility.Collapsed
        self.tkx_audit_start(True)

    def tkx_deep_row(self, key, cap, hint, cost, on, auto, deep_only):
        """One stage: cost dot, name, hint and an On / Off pill. A click flips it."""
        from System.Windows import HorizontalAlignment
        bd = Border()
        bd.CornerRadius = CornerRadius(8)
        bd.Padding = Thickness(6, 3, 6, 3)
        bd.Margin = Thickness(0, 0, 0, 1)
        bd.Background = Brushes.Transparent
        dp = DockPanel()
        if on:
            txt, bg, fg = u"On", u"#0071E3", u"#FFFFFF"
        elif auto:
            txt, bg, fg = u"Auto", u"#3A3A3C", u"#F5F5F7"
        else:
            txt, bg, fg = u"Off", u"#2C2C2E", u"#8E8E93"
        pill = Border()
        pill.CornerRadius = CornerRadius(12)
        pill.Height = 24.0
        pill.MinWidth = 84.0
        pill.Padding = Thickness(12, 0, 12, 0)
        pill.Background = isl_brush(bg)
        pill.VerticalAlignment = VerticalAlignment.Center
        pt = TextBlock()
        pt.Text = txt
        pt.FontSize = 11.5
        pt.FontWeight = FontWeights.SemiBold
        pt.Foreground = isl_brush(fg)
        pt.HorizontalAlignment = HorizontalAlignment.Center
        pt.VerticalAlignment = VerticalAlignment.Center
        pill.Child = pt
        DockPanel.SetDock(pill, Dock.Right)
        dp.Children.Add(pill)
        left = StackPanel()
        left.Orientation = Orientation.Horizontal
        dot = Border()
        dot.Width = 8.0
        dot.Height = 8.0
        dot.CornerRadius = CornerRadius(4)
        dot.Margin = Thickness(0, 0, 9, 0)
        dot.VerticalAlignment = VerticalAlignment.Center
        dot.Background = isl_brush({0: u"#2997FF", 1: u"#F5C542", 2: u"#FF6B6B"}.get(cost, u"#636366"))
        left.Children.Add(dot)
        nm = self.tkx_text(cap, 12.5, u"#F5F5F7" if (on or auto) else u"#8E8E93")
        nm.VerticalAlignment = VerticalAlignment.Center
        left.Children.Add(nm)
        if hint:
            ht = self.tkx_text(hint, 11, u"#636366", margin=Thickness(10, 0, 0, 0))
            ht.VerticalAlignment = VerticalAlignment.Center
            left.Children.Add(ht)
        dp.Children.Add(left)
        bd.Child = dp
        bd.Cursor = AnnCursors.Hand
        bd.ToolTip = (u"Click: on / off.  Dot: " + {0: u"fast", 1: u"medium", 2: u"can take long on a big model"}.get(cost, u"")
                      + (u".  Deep audit only" if deep_only else u""))
        bd.MouseEnter += lambda s, e, b=bd: setattr(b, "Background", isl_brush(u"#242426"))
        bd.MouseLeave += lambda s, e, b=bd: setattr(b, "Background", Brushes.Transparent)
        bd.MouseLeftButtonUp += lambda s, e, k=key: (setattr(e, "Handled", True), self.tkx_deep_toggle(k))
        return bd

    def tkx_deep_render(self):
        p = self.pnlDeepOpts
        if p is None:
            return
        sel = self._tkx_deep[u"sel"]
        p.Children.Clear()
        n_on = sum(1 for v in sel.values() if v)
        p.Children.Add(self.tkx_text(u"Deep audit: what to run", 13.5, u"#F5F5F7", bold=True))
        hint = self.tkx_text(u"Click a row to turn it on or off. A dot shows how long it can take: green fast, yellow medium, "
                             u"red slow on a big model. Stages that are not run keep their numbers from the previous audit "
                             u"of this model (or show a dash). The choice is remembered, also for Palette \u2192 Deep model audit.",
                             11, u"#8E8E93", margin=Thickness(2, 6, 0, 0))
        hint.TextWrapping = TextWrapping.Wrap
        p.Children.Add(hint)
        p.Children.Add(self.tkx_text(u"RUN  \u00B7  {} of {} selected".format(n_on, len(TKX_DEEP_STAGES)), 10.5, u"#8E8E93",
                                     bold=True, margin=Thickness(0, 12, 0, 6)))
        pr = AnnWrapPanel()
        pr.Margin = Thickness(0, 0, 0, 2)
        pr.Children.Add(self.home_chip(u"All", u"", lambda: self.tkx_deep_preset(u"all")))
        pr.Children.Add(self.home_chip(u"Only what Deep adds", u"", lambda: self.tkx_deep_preset(u"extra"),
                                       tip=u"Clashes, heaviest views, all families, line patterns in every view"))
        pr.Children.Add(self.home_chip(u"None", u"", lambda: self.tkx_deep_preset(u"none")))
        p.Children.Add(pr)
        need_views = bool(sel.get(u"patterns") or sel.get(u"heavy"))
        for key, pk, cap, h, cost, deep_only in TKX_DEEP_STAGES:
            on = bool(sel.get(key))
            auto = (key == u"views" and not on and need_views)
            p.Children.Add(self.tkx_deep_row(key, cap, h, cost, on, auto, deep_only))
        btns = StackPanel()
        btns.Orientation = Orientation.Horizontal
        btns.Margin = Thickness(0, 14, 0, 0)
        btns.Children.Add(self.home_chip(u"Run Deep audit", u"\uE768", self.tkx_deep_run, accent=True))
        btns.Children.Add(self.home_chip(u"Close", u"\uE711", self.tkx_deep_close))
        p.Children.Add(btns)
        for text, lv in (self._tkx_deep.get(u"note") or []):
            tb = TextBlock()
            tb.Text = text
            tb.FontSize = 11.5
            tb.TextWrapping = TextWrapping.Wrap
            tb.Margin = Thickness(0, 0, 0, 4)
            tb.Foreground = isl_brush({u"warn": u"#FFD479", u"bad": u"#FF6B6B"}.get(lv, u"#8E8E93"))
            p.Children.Add(tb)

    def tkx_do_audit(self, uiapp_):
        self.tkx_audit_run(uiapp_, False)

    def tkx_do_audit_deep(self, uiapp_):
        self.tkx_audit_run(uiapp_, True)

    def tkx_prog_set(self, text, frac, eta, deep=None):
        """Progress bar + status line (called from the audit steps; redraws the window)."""
        try:
            if deep is None:
                deep = getattr(self, "_tkx_audit_deep_req", False)
            f = max(0.0, min(1.0, float(frac)))
            s = u"{}  \u00B7  {}%  \u00B7  {}".format(u"Deep audit" if deep else u"Audit", int(f * 100), text)
            if eta:
                s += u"  \u00B7  remaining \u2248 " + tkx_fmt_eta(eta)
            s += u"  \u00B7  Esc \u2014 cancel"
            self.tbAuditStatus.Text = s
            self.gridAuditProg.Visibility = Visibility.Visible
            self.barAuditFill.RenderTransform.ScaleX = f
            pg = getattr(self, "_prog", None)
            if pg and pg.get("audit"):
                self.prog_update(int(f * 1000))              # the pill: "Deep audit 37%" + the thin bar
            else:
                self.ui_pump()
        except Exception:
            pass

    def tkx_prog_hide(self):
        try:
            self.barAuditFill.RenderTransform.ScaleX = 0.0
            self.gridAuditProg.Visibility = Visibility.Collapsed
        except Exception:
            pass

    def tkx_esc_pressed(self):
        """Esc pressed (while this process's window is active). Clicks during the audit are not processed, so we poll the key."""
        try:
            import ctypes
            u32 = ctypes.windll.user32
            if not (u32.GetAsyncKeyState(0x1B) & 0x8001):
                return False
            pid = ctypes.c_ulong(0)
            u32.GetWindowThreadProcessId(u32.GetForegroundWindow(), ctypes.byref(pid))
            return int(pid.value) == int(os.getpid())
        except Exception:
            return False

    def tkx_audit_confirm(self, n):
        try:
            from System.Windows import MessageBoxButton, MessageBoxImage, MessageBoxResult
            r = MessageBox.Show(
                self.win,
                u"The Deep audit will check {} views (dependent ones are skipped).\n\n"
                u"Approximately {}, but it all depends on the model. Revit is busy meanwhile; progress is shown in the pill at the top.\n"
                u"Esc cancels the audit and keeps everything already collected.\n\nContinue?".format(tkx_num(n), tkx_fmt_eta(n * 0.25)),
                u"Deep audit", MessageBoxButton.YesNo, MessageBoxImage.Question)
            self.tkx_esc_pressed()                       # reset the "sticky" Esc from the dialog
            return r == MessageBoxResult.Yes
        except Exception:
            return True

    def tkx_audit_run(self, uiapp_, deep):
        ad = uiapp_.ActiveUIDocument
        d = ad.Document if ad else None
        if d is None or d.IsFamilyDocument:
            self.tkx_prog_hide()
            self.prog_end()
            self.tbAuditStatus.Text = u"Open an RVT project."
            return
        self._tkx_audit_busy = True
        prev_res = self._tkx_audit
        pill_text, pill_fail = None, True
        self.prog_wait_collapse()                        # let the island finish collapsing before Revit gets busy
        self.tkx_esc_pressed()                           # reset the "sticky" Esc
        try:
            def step(text, frac, eta):
                self.tkx_prog_set(text, frac, eta, deep)
                if self.tkx_esc_pressed():
                    raise TkxAuditStop()
            try:
                budget = None if deep else float(self.settings.get("audit_budget", TKX_BUDGET))
            except Exception:
                budget = TKX_BUDGET
            only = self.tkx_deep_only() if deep else None
            res = tkx_audit_collect(d, step, deep, budget, self.tkx_audit_confirm, only)
            if deep and res.get(u"skipped") and prev_res and prev_res.get(u"doc") == res[u"doc"]:
                kept, still = [], []
                for sk in res[u"skipped"]:
                    got = False
                    if sk not in (prev_res.get(u"skipped") or []):
                        for rk in TKX_STAGE_KEYS.get(sk, ()):
                            if rk in prev_res:
                                res[rk] = prev_res[rk]
                                got = True
                    (kept if got else still).append(sk)
                res[u"skipped"] = still
                if kept:
                    res[u"notes"].append(u"Not run this time, numbers kept from the previous audit: {}".format(
                        u", ".join(r[2] for r in TKX_DEEP_STAGES if r[0] in kept)))
            if (not deep and prev_res and prev_res.get(u"doc") == res[u"doc"]
                    and prev_res.get(u"views", {}).get(u"deep")):
                res[u"views"] = prev_res[u"views"]       # heaviest views data from the previous Deep audit
            if (not deep and prev_res and prev_res.get(u"doc") == res[u"doc"]
                    and (prev_res.get(u"clashes") or {}).get(u"ran")):
                res[u"clashes"] = prev_res[u"clashes"]   # clashes from the previous Deep audit
            store = self.settings.setdefault("audit_last", {})
            res[u"prev"] = store.get(res[u"doc"])
            if not res.get(u"cancelled"):
                store[res[u"doc"]] = tkx_audit_numbers(res)
                save_settings(self.settings)
            self._tkx_audit = res
            tkx_audit_save(res)
            self._tkx_sel = None
            self._tkx_audit_dirty = True
            pill_fail = False
            pill_text = u"Cancelled" if res.get(u"cancelled") else (u"Has errors" if res.get(u"err") else u"Done")
        finally:
            self._tkx_audit_busy = False
            self.tkx_prog_hide()
            pg = getattr(self, "_prog", None)
            if pg and pg.get("audit"):
                self.prog_done(pill_fail, pill_text)
        self.tkx_home_render()

    def tkx_budget_cycle(self):
        vals = [30, 60, 120, 300]
        try:
            cur = int(self.settings.get("audit_budget", TKX_BUDGET))
        except Exception:
            cur = 60
        nxt = vals[(vals.index(cur) + 1) % len(vals)] if cur in vals else 60
        self.settings["audit_budget"] = nxt
        save_settings(self.settings)
        try:
            sp = self._tkx_budget_chip.Child
            sp.Children[sp.Children.Count - 1].Text = u"{} s".format(nxt)
        except Exception:
            pass
        self.hdr_toast(u"Quick audit limit per heaviest step: {} s (Deep audit has no limit)".format(nxt))

    def tkx_audit_tile(self, key, value, caption, level, sub, selected, frac=0.0):
        from System.Windows import HorizontalAlignment
        bd = Border()
        bd.CornerRadius = CornerRadius(16)
        bd.Width = 134.0
        bd.MinHeight = 94.0
        bd.Margin = Thickness(0, 0, 8, 8)
        bd.Padding = Thickness(12, 9, 10, 9)
        bd.Cursor = AnnCursors.Hand
        bg = u"#2C2C2E" if selected else u"#1C1C1E"
        bd.Background = isl_brush(bg)
        sp = StackPanel()
        vcol = {u"bad": u"#FF6B6B", u"warn": u"#FFD479"}.get(level, u"#F5F5F7")
        sp.Children.Add(self.tkx_text(value, 22, vcol, bold=True))
        cap = self.tkx_text(caption, 11, u"#8E8E93")
        cap.TextWrapping = TextWrapping.Wrap
        sp.Children.Add(cap)
        if sub:
            sp.Children.Add(self.tkx_text(sub, 10.5, u"#98989D"))
        if level in (u"ok", u"warn", u"bad"):
            g = WpfGrid()
            g.Height = 3.0
            g.Margin = Thickness(0, 7, 0, 0)
            tr = Border()
            tr.CornerRadius = CornerRadius(1.5)
            tr.Background = isl_brush(u"#3A3A3C")
            g.Children.Add(tr)
            if level != u"ok" or frac > 0:
                fl = Border()
                fl.CornerRadius = CornerRadius(1.5)
                fl.HorizontalAlignment = HorizontalAlignment.Left
                fl.Width = max(4.0, 112.0 * float(frac))
                fl.Background = isl_brush({u"bad": u"#FF6B6B", u"warn": u"#F5C542", u"ok": u"#2997FF"}[level])
                g.Children.Add(fl)
            sp.Children.Add(g)
        bd.Child = sp
        bd.MouseEnter += lambda s, e: setattr(bd, "Background", isl_brush(u"#2C2C2E"))
        bd.MouseLeave += lambda s, e: setattr(bd, "Background", isl_brush(bg))
        bd.MouseLeftButtonUp += lambda s, e: (setattr(e, "Handled", True), self.tkx_audit_pick(key))
        return bd

    def tkx_audit_pick(self, key):
        self._tkx_sel = None if self._tkx_sel == key else key
        self.tkx_audit_render()

    def tkx_audit_render(self):
        res = self._tkx_audit
        p = self.pnlAuditTiles
        p.Children.Clear()
        if not res:
            self.tbAuditStatus.Text = (u"The audit has not been run yet. Quick: file size, warnings, CAD, in-place, views not on sheets, groups, "
                                       u"rooms, options, duplicates, unused filters / templates / line patterns, Revit links, unpinned levels and grids, "
                                       u"sheets without views, views without template, unused families, families. "
                                       u"Deep: also clashes and every view with no time limit.")
            self.cardAuditDetail.Visibility = Visibility.Collapsed
            return
        nn = len(res.get(u"notes") or [])
        notes = u"  \u00B7  {} note{} (hover)".format(nn, u"" if nn == 1 else u"s") if nn else u""
        errs = u"  \u00B7  steps with errors: {}".format(len(res[u"err"])) if res.get(u"err") else u""
        self.tbAuditStatus.Text = u"{}  \u00B7  {}  \u00B7  {}  \u00B7  {:.1f} s{}{}".format(
            tkx_short(res[u"doc"], 34), tkx_when(res[u"t"]),
            u"deep" if res.get(u"deep") else u"quick", res.get(u"dur", 0), notes, errs)
        try:
            self.tbAuditStatus.ToolTip = u"\n".join(list(res.get(u"notes") or []) + list(res.get(u"err") or [])) or None
        except Exception:
            pass
        for key, val, cap, lv, sub, fr in tkx_audit_tiles(res, res.get(u"prev")):
            p.Children.Add(self.tkx_audit_tile(key, val, cap, lv, sub, key == self._tkx_sel, fr))
        if self._tkx_sel:
            self.tkx_audit_detail_fill(res, self._tkx_sel)
            self.cardAuditDetail.Visibility = Visibility.Visible
        else:
            self.cardAuditDetail.Visibility = Visibility.Collapsed
        self.tkx_rpt_refresh()

    def tkx_audit_copy(self):
        if not self._tkx_audit:
            self.hdr_toast(u"Run the audit first")
            return
        ok = tkx_clip_set(tkx_audit_report(self._tkx_audit))
        self.hdr_toast(u"Audit report copied" if ok else u"Could not copy: the clipboard is busy")

    # ------------------------------------------------------------ Audit rows: a click shows the thing in the model
    # element rows  -> select + Selection Box (section box in a 3D view) + highlight colour in that view ("Clear highlight" undoes it)
    # annotation rows (view-owned elements) -> open the view they live in, select, zoom, highlight
    # view rows     -> open the view
    # filters / templates / patterns / design options -> open the Revit dialog (they are not in any view); the name is copied
    def tkx_audit_row(self, text, tg):
        bd = Border()
        bd.CornerRadius = CornerRadius(8)
        bd.Padding = Thickness(8, 4, 8, 4)
        bd.Margin = Thickness(0, 0, 0, 1)
        dp = DockPanel()
        if tg is not None:
            hint = TextBlock()
            hint.Text = tkx_target_glyph(tg)
            hint.FontFamily = ICON_FONT
            hint.FontSize = 13.0
            hint.Foreground = isl_brush(u"#8E8E93")
            hint.Margin = Thickness(12, 0, 0, 0)
            hint.VerticalAlignment = VerticalAlignment.Center
            DockPanel.SetDock(hint, Dock.Right)
            dp.Children.Add(hint)
        tb = TextBlock()
        tb.Text = text
        tb.FontSize = 11.5
        tb.Foreground = isl_brush(u"#D1D1D6" if tg is None else u"#F5F5F7")
        tb.TextWrapping = TextWrapping.Wrap
        dp.Children.Add(tb)
        bd.Child = dp
        if tg is not None:
            bd.Cursor = AnnCursors.Hand
            bd.Background = isl_brush(u"#1C1C1E")
            if tg.get(u"what"):
                bd.ToolTip = u"Not in any view: opens {}. The name is copied.".format(tg[u"what"])
            elif tg.get(u"kind") == u"view":
                bd.ToolTip = u"Opens the view"
            else:
                bd.ToolTip = u"Selects in the model; 3D view with a section box around it and a highlight colour (Selection Box)"
            bd.MouseEnter += lambda s, e, b=bd: setattr(b, "Background", isl_brush(u"#2C2C2E"))
            bd.MouseLeave += lambda s, e, b=bd: setattr(b, "Background", isl_brush(u"#1C1C1E"))
            bd.MouseLeftButtonUp += lambda s, e, t=tg: (setattr(e, "Handled", True), self.tkx_audit_show_req(t))
        return bd

    def tkx_audit_detail_fill(self, res, key):
        title, rows = tkx_audit_rows(res, key)
        self.tbAuditDetailTitle.Text = title
        pr = self.pnlAuditRows
        pr.Children.Clear()
        for ln, tg in rows:
            pr.Children.Add(self.tkx_audit_row(ln, tg))
        self.tbAuditDetail.Text = u"Empty."
        self.tbAuditDetail.Visibility = Visibility.Collapsed if rows else Visibility.Visible
        self.tkx_audit_btns()

    def tkx_audit_btns(self):
        pb = self.pnlAuditDetailBtns
        if pb is None:
            return
        pb.Children.Clear()
        res, key = self._tkx_audit, self._tkx_sel
        if not res or not key:
            return
        allt = tkx_audit_all(res, key)
        if allt is not None:
            pb.Children.Add(self.home_chip(u"Show all in model", u"\uE7B3", lambda: self.tkx_audit_show_req(allt),
                                           tip=u"Selects everything from this list and fits a 3D section box around it (up to {} elements)".format(TKX_SHOW_MAX)))
        if getattr(self, "_tkx_hl", None):
            pb.Children.Add(self.home_chip(u"Clear highlight", u"\uE894", self.tkx_hl_clear_req,
                                           tip=u"Returns colours, hidden elements and the section box of the highlighted view to what they were"))

    def tkx_audit_show_req(self, tg):
        # the latest click wins: drop a still-queued earlier one
        self.handler.queue[:] = [(k, f) for k, f in self.handler.queue if k != u"tkx_show"]
        self.run(lambda ua: self.tkx_audit_show(ua, tg), u"tkx_show")

    def tkx_hl_clear_req(self):
        self.run(self.tkx_do_hl_clear, u"tkx_hl")

    def tkx_audit_show(self, uiapp_, tg):
        ui = uiapp_.ActiveUIDocument
        d = ui.Document if ui is not None else None
        if d is None or d.IsFamilyDocument:
            self.hdr_toast(u"Open an RVT project")
            return
        try:
            kind = tg.get(u"kind")
            if kind == u"view":
                self.tkx_open_view(ui, d, tg[u"id"])
            elif kind == u"cmd":
                self.tkx_open_cmd(uiapp_, tg)
            else:
                ids, note = tkx_resolve_ids(d, tg)
                self.tkx_show_ids(uiapp_, ui, d, ids, note)
        except Exception as ex:
            tk_log(u"audit show: {}\n{}".format(ex, traceback.format_exc()))
            self.hdr_toast(u"Could not show it: {}".format(err_text(ex)))

    def tkx_open_view(self, ui, d, vid):
        v = d.GetElement(revit_id(vid))
        if v is None:
            self.hdr_toast(u"The view no longer exists. Re-run the audit")
            return
        try:
            ui.ActiveView = v
        except Exception:
            ui.RequestViewChange(v)
        self.hdr_toast(u"Opened: {}".format(tkx_short(v.Name, 50)))

    def tkx_open_cmd(self, uiapp_, tg):
        pc = None
        for nm in tg.get(u"cmds", []):
            pc = getattr(PostableCommand, str(nm), None)
            if pc is not None:
                break
        copied = u""
        if tg.get(u"copy"):
            copied = u" Name copied." if tkx_clip_set(tg[u"copy"]) else u""
        cid = None
        if pc is not None:
            try:
                cid = RevitCommandId.LookupPostableCommandId(pc)
            except Exception:
                cid = None
        if cid is None:
            self.hdr_toast(u"Open it manually: {}.{}".format(tg.get(u"what", u""), copied))
            return
        uiapp_.PostCommand(cid)
        self.hdr_toast(u"Opening: {}.{}".format(tg.get(u"what", u""), copied))

    def tkx_show_ids(self, uiapp_, ui, d, ids, note):
        els = []
        for i in ids:
            try:
                e = d.GetElement(revit_id(i))
            except Exception:
                e = None
            if e is not None and not isinstance(e, DB.ElementType):
                els.append(e)
        if not els:
            self.hdr_toast(u"Nothing to show: the elements are gone or none were found. Re-run the audit")
            return
        sel = List[ElementId]([e.Id for e in els])
        owned, model = {}, []
        for e in els:
            ov = -1
            try:
                ov = id_value(e.OwnerViewId)
            except Exception:
                ov = -1
            if ov != -1:
                owned.setdefault(ov, []).append(e)
            else:
                model.append(e)
        boxes = [b for b in (tkx_elem_box(e) for e in model) if b is not None]
        skipped = 0
        if boxes:
            # model elements -> Selection Box in a 3D view
            skipped = sum(len(v) for v in owned.values())
            sel = List[ElementId]([e.Id for e in model])
            tview = tkx_pick_3d(uiapp_, ui, d)
            paint, box = model, tkx_union_box(boxes)
        elif owned:
            # view-specific elements (annotations, view-only CAD) -> the view they live in
            vid = max(owned.keys(), key=lambda k: len(owned[k]))
            tview = d.GetElement(revit_id(vid))
            paint, box = owned[vid], None
            skipped = len(els) - len(paint)
            sel = List[ElementId]([e.Id for e in paint])
        else:
            tview, paint, box = None, [], None
        if tview is None and box is None:
            # nothing that can be shown (e.g. unplaced rooms): select only
            ui.Selection.SetElementIds(sel)
            self.hdr_toast(u"{} element(s) selected. They have no geometry in a view (e.g. unplaced rooms): find them in a schedule or Properties".format(len(els)))
            return
        paint_ids = []
        for e in paint:
            paint_ids.append(e.Id)
            if isinstance(e, DB.Group):                       # a group is painted through its members
                try:
                    paint_ids.extend(list(e.GetMemberIds()))
                except Exception:
                    pass
        prev = getattr(self, "_tkx_hl", None)
        st = None
        tr = Transaction(d, u"Universal Toolkit: show in model")
        tr.Start()
        try:
            tkx_hl_restore(d, prev)
            if tview is None:
                tview = tkx_make_3d(d)
            st = {u"doc": unicode(d.Title), u"view": id_value(tview.Id), u"ov": {}, u"hid": [], u"sb": None}
            if box is not None:
                try:
                    st[u"sb"] = (bool(tview.IsSectionBoxActive), tview.GetSectionBox())
                    tview.SetSectionBox(box)
                    tview.IsSectionBoxActive = True
                except Exception as ex:
                    st[u"sb"] = None
                    tk_log(u"audit show: section box: {}".format(ex))
            hid = []
            for pid in paint_ids:
                try:
                    pe = d.GetElement(pid)
                    if pe is not None and pe.IsHidden(tview) and pe.CanBeHidden(tview):
                        hid.append(pid)
                except Exception:
                    pass
            if hid:
                try:
                    tview.UnhideElements(List[ElementId](hid))
                    st[u"hid"] = [id_value(x) for x in hid]
                except Exception:
                    pass
            og = tkx_hl_ogs(d)
            for pid in paint_ids:
                try:
                    st[u"ov"][id_value(pid)] = tview.GetElementOverrides(pid)
                    tview.SetElementOverrides(pid, og)
                except Exception:
                    pass
            tr.Commit()
        except Exception:
            try:
                tr.RollBack()
            except Exception:
                pass
            raise
        self._tkx_hl = st
        try:
            if id_value(ui.ActiveView.Id) != id_value(tview.Id):
                try:
                    ui.ActiveView = tview
                except Exception:
                    ui.RequestViewChange(tview)
        except Exception as ex:
            tk_log(u"audit show: view change: {}".format(ex))
        try:
            ui.Selection.SetElementIds(sel)
        except Exception as ex:
            tk_log(u"audit show: selection: {}".format(ex))
        try:
            ui.ShowElements(sel)
        except Exception:
            pass
        vis = tkx_visible_in(d, tview, [id_value(e.Id) for e in paint])
        parts = [u"{}: {} element(s) in \u00AB{}\u00BB{}".format(
            u"Selection Box" if box is not None else u"Shown", len(paint), tkx_short(tview.Name, 40),
            u", highlighted" if st[u"ov"] else u"")]
        if vis is not None and len(vis) < len(paint):
            parts.append(u"{} not visible there (hidden by category, filter, phase or workset)".format(len(paint) - len(vis)))
        if skipped:
            parts.append(u"{} view-specific element(s) in other views skipped".format(skipped))
        if note:
            parts.append(note)
        self.hdr_toast(u"; ".join(parts))
        self.tkx_audit_btns()

    def tkx_do_hl_clear(self, uiapp_):
        st = getattr(self, "_tkx_hl", None)
        ui = uiapp_.ActiveUIDocument
        d = ui.Document if ui is not None else None
        if st is None or d is None:
            self._tkx_hl = None
            self.tkx_audit_btns()
            return
        if st.get(u"doc") != unicode(d.Title):
            self._tkx_hl = None
            self.hdr_toast(u"The highlight was in another model; nothing to clear here")
            self.tkx_audit_btns()
            return
        tr = Transaction(d, u"Universal Toolkit: clear highlight")
        tr.Start()
        try:
            tkx_hl_restore(d, st)
            tr.Commit()
        except Exception as ex:
            try:
                tr.RollBack()
            except Exception:
                pass
            self.hdr_toast(u"Could not clear the highlight: {}".format(err_text(ex)))
            return
        self._tkx_hl = None
        self.hdr_toast(u"Highlight cleared")
        self.tkx_audit_btns()


    # ------------------------------------------------------------ Audit report -> view / sheet / schedules in the model
    # What to create is chosen in an inline card on Home (the toolkit's own interface, no system dialogs).
    # The creation itself runs in the Revit context (self.run) and writes its result back into the same card.
    def tkx_report_model_start(self, open_only=False):
        if not self._tkx_audit:
            self.hdr_toast(u"Run the audit first")
            return
        if self.cardRptOpts is None:
            return
        if self.cardRptOpts.Visibility == Visibility.Visible and not open_only:
            self.cardRptOpts.Visibility = Visibility.Collapsed
            return
        self._tkx_rpt[u"note"] = []
        self.tkx_rpt_opts_render()
        if self.cardDeepOpts is not None:
            self.cardDeepOpts.Visibility = Visibility.Collapsed
        self.cardRptOpts.Visibility = Visibility.Visible

    def tkx_report_model_open(self):
        self.tkx_report_model_start(True)

    def tkx_rpt_refresh(self):
        """After a new audit: the card follows the data (legend name) or hides if there is no data."""
        try:
            if self.cardRptOpts is not None and self.cardRptOpts.Visibility == Visibility.Visible:
                if self._tkx_audit:
                    self.tkx_rpt_opts_render()
                else:
                    self.cardRptOpts.Visibility = Visibility.Collapsed
        except Exception as ex:
            tk_log(u"tkx_rpt_refresh: {}".format(ex))

    def tkx_rpt_close(self):
        self.cardRptOpts.Visibility = Visibility.Collapsed

    def tkx_rpt_set(self, key, val):
        o = self._tkx_rpt
        o[key] = val
        try:
            self.settings[u"rpt_" + key] = val
            save_settings(self.settings)
        except Exception as ex:
            tk_log(u"tkx_rpt_set: {}".format(ex))
        o[u"note"] = []
        self.tkx_rpt_opts_render()

    def tkx_rpt_save(self):
        try:
            o = self._tkx_rpt
            self.settings[u"rpt_scheds"] = dict(o[u"scheds"])
            self.settings[u"rpt_sel"] = {u"full": dict(o[u"sel"][u"full"]), u"compact": dict(o[u"sel"][u"compact"])}
            save_settings(self.settings)
        except Exception as ex:
            tk_log(u"tkx_rpt_save: {}".format(ex))

    def tkx_rpt_cycle(self, key):
        """Click on an item row: Off -> Tile -> Tile + list -> Off (Compact: Off <-> On)."""
        o = self._tkx_rpt
        fmt = o[u"fmt"] if o[u"fmt"] in (u"full", u"compact") else u"full"
        sel = o[u"sel"][fmt]
        top = 2 if (fmt == u"full" and tkx_rpt_has_list(key)) else 1
        sel[key] = (int(sel.get(key, 0)) + 1) % (top + 1)
        o[u"note"] = []
        self.tkx_rpt_save()
        self.tkx_rpt_opts_render()

    def tkx_rpt_preset(self, which):
        o = self._tkx_rpt
        fmt = o[u"fmt"] if o[u"fmt"] in (u"full", u"compact") else u"full"
        res = self._tkx_audit or {}
        sel = tkx_rpt_default_sel(fmt)
        lv = {}
        try:
            for tl in tkx_audit_tiles(res, None):
                lv[tl[0]] = tl[3]
        except Exception as ex:
            tk_log(u"tkx_rpt_preset: {}".format(ex))
        for key, cap, lst in TK_RPT_ITEMS:
            top = 2 if (fmt == u"full" and lst) else 1
            if which == u"none":
                sel[key] = 0
            elif which == u"all":
                sel[key] = top if tkx_item_avail(res, key) else 0
            elif which == u"problems":
                sel[key] = top if (tkx_item_avail(res, key) and lv.get(key) in (u"bad", u"warn")) else 0
        o[u"sel"][fmt] = sel
        o[u"note"] = []
        self.tkx_rpt_save()
        self.tkx_rpt_opts_render()

    def tkx_rpt_sched_toggle(self, key):
        o = self._tkx_rpt
        o[u"scheds"][key] = not bool(o[u"scheds"].get(key))
        o[u"note"] = []
        self.tkx_rpt_save()
        self.tkx_rpt_opts_render()

    def tkx_rpt_item_row(self, key, cap, mode, val, lv, avail, full):
        """One audit item in the Report card: level dot, name, value, and a pill with what goes into the model."""
        from System.Windows import HorizontalAlignment
        bd = Border()
        bd.CornerRadius = CornerRadius(8)
        bd.Padding = Thickness(6, 3, 6, 3)
        bd.Margin = Thickness(0, 0, 0, 1)
        bd.Background = Brushes.Transparent
        dp = DockPanel()
        if not avail:
            txt, bg, fg = u"no data", u"#1C1C1E", u"#636366"
        elif mode == 0:
            txt, bg, fg = u"Off", u"#2C2C2E", u"#8E8E93"
        elif mode == 1:
            txt, bg, fg = (u"Tile" if full else u"On"), u"#3A3A3C", u"#F5F5F7"
        else:
            txt, bg, fg = u"Tile + list", u"#0071E3", u"#FFFFFF"
        pill = Border()
        pill.CornerRadius = CornerRadius(12)
        pill.Height = 24.0
        pill.MinWidth = 84.0
        pill.Padding = Thickness(12, 0, 12, 0)
        pill.Background = isl_brush(bg)
        pill.VerticalAlignment = VerticalAlignment.Center
        pt = TextBlock()
        pt.Text = txt
        pt.FontSize = 11.5
        pt.FontWeight = FontWeights.SemiBold
        pt.Foreground = isl_brush(fg)
        pt.HorizontalAlignment = HorizontalAlignment.Center
        pt.VerticalAlignment = VerticalAlignment.Center
        pill.Child = pt
        DockPanel.SetDock(pill, Dock.Right)
        dp.Children.Add(pill)
        left = StackPanel()
        left.Orientation = Orientation.Horizontal
        dot = Border()
        dot.Width = 8.0
        dot.Height = 8.0
        dot.CornerRadius = CornerRadius(4)
        dot.Margin = Thickness(0, 0, 9, 0)
        dot.VerticalAlignment = VerticalAlignment.Center
        dot.Background = isl_brush({u"bad": u"#FF6B6B", u"warn": u"#F5C542", u"ok": u"#2997FF"}.get(lv, u"#636366") if avail else u"#48484A")
        left.Children.Add(dot)
        nm = self.tkx_text(cap, 12.5, u"#F5F5F7" if avail else u"#636366")
        nm.VerticalAlignment = VerticalAlignment.Center
        left.Children.Add(nm)
        vt = self.tkx_text(val if avail else u"", 11.5, u"#8E8E93", margin=Thickness(10, 0, 0, 0))
        vt.VerticalAlignment = VerticalAlignment.Center
        left.Children.Add(vt)
        dp.Children.Add(left)
        bd.Child = dp
        if avail:
            bd.Cursor = AnnCursors.Hand
            bd.ToolTip = u"Click: Off \u2192 Tile \u2192 Tile + list" if full else u"Click: on / off"
            bd.MouseEnter += lambda s, e, b=bd: setattr(b, "Background", isl_brush(u"#242426"))
            bd.MouseLeave += lambda s, e, b=bd: setattr(b, "Background", Brushes.Transparent)
            bd.MouseLeftButtonUp += lambda s, e, k=key: (setattr(e, "Handled", True), self.tkx_rpt_cycle(k))
        else:
            bd.ToolTip = u"No data in the last audit (run the Deep audit)"
        return bd

    def tkx_rpt_seg(self, opts, cur, on_pick):
        """Segmented selector: opts = [(key, text, enabled)]."""
        from System.Windows import HorizontalAlignment
        wrap = Border()
        wrap.CornerRadius = CornerRadius(17)
        wrap.Background = isl_brush(u"#2C2C2E")
        wrap.Padding = Thickness(3)
        wrap.HorizontalAlignment = HorizontalAlignment.Left
        row = StackPanel()
        row.Orientation = Orientation.Horizontal
        for key, text, enabled in opts:
            sel = (key == cur)
            seg = Border()
            seg.CornerRadius = CornerRadius(14)
            seg.Height = 28.0
            seg.Padding = Thickness(14, 0, 14, 0)
            seg.Background = isl_brush(u"#0071E3") if sel else Brushes.Transparent
            tb = TextBlock()
            tb.Text = text
            tb.FontWeight = FontWeights.SemiBold
            tb.VerticalAlignment = VerticalAlignment.Center
            tb.Foreground = ann_brush(u"#FFFFFF") if sel else isl_brush(u"#F5F5F7" if enabled else u"#636366")
            seg.Child = tb
            if enabled and not sel:
                seg.Cursor = AnnCursors.Hand
                seg.MouseLeftButtonUp += (lambda s, e, k=key: (setattr(e, "Handled", True), on_pick(k)))
            row.Children.Add(seg)
        wrap.Child = row
        return wrap

    def tkx_rpt_check(self, title, sub, on, on_click):
        """A row with a check box (rounded square) + title + explanation."""
        from System.Windows import HorizontalAlignment
        row = StackPanel()
        row.Orientation = Orientation.Horizontal
        row.Cursor = AnnCursors.Hand
        row.Margin = Thickness(0, 2, 0, 0)
        box = Border()
        box.Width = 20.0
        box.Height = 20.0
        box.CornerRadius = CornerRadius(6)
        box.VerticalAlignment = VerticalAlignment.Top
        box.Margin = Thickness(0, 1, 0, 0)
        if on:
            box.Background = isl_brush(u"#0071E3")
            ic = TextBlock()
            ic.Text = u"\uE73E"
            ic.FontFamily = ICON_FONT
            ic.FontSize = 12.0
            ic.Foreground = ann_brush(u"#FFFFFF")
            ic.HorizontalAlignment = HorizontalAlignment.Center
            ic.VerticalAlignment = VerticalAlignment.Center
            box.Child = ic
        else:
            box.BorderBrush = isl_brush(u"#636366")
            box.BorderThickness = Thickness(1.5)
        row.Children.Add(box)
        col = StackPanel()
        col.Margin = Thickness(10, 0, 0, 0)
        col.Children.Add(self.tkx_text(title, 12.5, u"#F5F5F7", bold=True))
        st = self.tkx_text(sub, 11, u"#8E8E93")
        st.TextWrapping = TextWrapping.Wrap
        st.MaxWidth = 380.0
        col.Children.Add(st)
        row.Children.Add(col)
        row.MouseLeftButtonUp += lambda s, e: (setattr(e, "Handled", True), on_click())
        return row

    def tkx_rpt_opts_render(self):
        p = self.pnlRptOpts
        if p is None:
            return
        res = self._tkx_audit or {}
        o = self._tkx_rpt
        leg = res.get(u"legend0") or u""
        if o.get(u"where") == u"legend" and not leg:
            o[u"where"] = u"sheet"
        if o.get(u"fmt") not in (u"full", u"compact"):
            o[u"fmt"] = u"full"
        full = (o[u"fmt"] == u"full")
        p.Children.Clear()

        def hint(text):
            tb = self.tkx_text(text, 11, u"#8E8E93", margin=Thickness(2, 6, 0, 0))
            tb.TextWrapping = TextWrapping.Wrap
            return tb

        def label(text):
            return self.tkx_text(text, 10.5, u"#8E8E93", bold=True, margin=Thickness(0, 12, 0, 6))
        p.Children.Add(self.tkx_text(u"Report to model", 13.5, u"#F5F5F7", bold=True))
        p.Children.Add(hint(u"Creates new views in the model. This is a model change: one Undo (or the Undo button in the action log) reverts it."))
        p.Children.Add(label(u"REPORT"))
        p.Children.Add(self.tkx_rpt_seg([(u"full", u"Extended", True), (u"compact", u"Compact", True)], o[u"fmt"],
                                        lambda k: self.tkx_rpt_set(u"fmt", k)))
        p.Children.Add(hint(u"The items you pick below, with charts and full lists, in one large view." if full else
                            u"A single strip with the items you pick below: place it on the project's main sheet (like a cover sheet)."))
        p.Children.Add(label(u"PLACE"))
        p.Children.Add(self.tkx_rpt_seg([(u"sheet", u"Sheet", True), (u"legend", u"Legend", bool(leg)),
                                         (u"drafting", u"Drafting view", True)], o.get(u"where"),
                                        lambda k: self.tkx_rpt_set(u"where", k)))
        w = o.get(u"where")
        if w == u"legend":
            p.Children.Add(hint(u"Duplicates the legend \u00AB{}\u00BB and replaces its content with the report.".format(tkx_short(leg, 40))))
        elif w == u"drafting":
            p.Children.Add(hint(u"A drafting view only, no sheet: you place it yourself."))
        else:
            p.Children.Add(hint(u"A new drafting view and a new sheet that carries it." + (u"" if leg else u"  No legends in the model.")))
        # ---- every audit item separately
        fmt_k = u"full" if full else u"compact"
        sel = o[u"sel"][fmt_k]
        tl = {}
        try:
            for t_ in tkx_audit_tiles(res, None):
                tl[t_[0]] = t_
        except Exception as ex:
            tk_log(u"tkx_rpt_opts_render tiles: {}".format(ex))
        n_on = 0
        for key, cap, lst in TK_RPT_ITEMS:
            if sel.get(key, 0) and tkx_item_avail(res, key):
                n_on += 1
        p.Children.Add(label(u"INCLUDE  \u00B7  {} selected".format(n_on)))
        p.Children.Add(hint(u"Click a row to cycle Off \u2192 Tile \u2192 Tile + list. The list is every element behind the number "
                            u"(clashes, views, families, rooms\u2026)." if full else
                            u"Click a row to put the metric in the strip or take it out."))
        pr = AnnWrapPanel()
        pr.Margin = Thickness(0, 6, 0, 2)
        pr.Children.Add(self.home_chip(u"All", u"", lambda: self.tkx_rpt_preset(u"all")))
        pr.Children.Add(self.home_chip(u"Only problems", u"", lambda: self.tkx_rpt_preset(u"problems"),
                                       tip=u"Only items rated Needs attention or Critical"))
        pr.Children.Add(self.home_chip(u"None", u"", lambda: self.tkx_rpt_preset(u"none")))
        pr.Children.Add(self.home_chip(u"Default", u"", lambda: self.tkx_rpt_preset(u"default"),
                                       tip=u"Extended: everything; Compact: the usual 9 metrics"))
        p.Children.Add(pr)
        for key, cap, lst in TK_RPT_ITEMS:
            t_ = tl.get(key)
            p.Children.Add(self.tkx_rpt_item_row(key, cap, int(sel.get(key, 0)), t_[1] if t_ else u"", t_[3] if t_ else u"info",
                                                 tkx_item_avail(res, key), full))
        if full:
            p.Children.Add(label(u"SEARCH IN REVIT (SCHEDULES)"))
            p.Children.Add(hint(u"Real Revit tables you can sort, filter and use for Highlight in Model. Each one is separate. "
                                u"Warnings, clashes, links, unused filters, templates and line patterns cannot be scheduled by Revit: they stay in the report."))
            exp = {u"offsheet": (res.get(u"offsheet") or {}).get(u"n"),
                   u"rooms": ((res.get(u"rooms") or {}).get(u"n", 0) + (res.get(u"rooms") or {}).get(u"unenclosed", 0)) if res.get(u"rooms") else None}
            for sk, st_title in TK_RPT_SCHEDS:
                p.Children.Add(self.tkx_rpt_check(
                    st_title, u"Expected rows: {}".format(exp.get(sk) if exp.get(sk) is not None else u"?"),
                    bool(o[u"scheds"].get(sk)), lambda k=sk: self.tkx_rpt_sched_toggle(k)))
        btns = StackPanel()
        btns.Orientation = Orientation.Horizontal
        btns.Margin = Thickness(0, 14, 0, 0)
        btns.Children.Add(self.home_chip(u"Create", u"\uE710", self.tkx_rpt_create, accent=True))
        btns.Children.Add(self.home_chip(u"Close", u"\uE711", self.tkx_rpt_close))
        p.Children.Add(btns)
        lime = u"#0071E3" if TK_ISL[u"light"] else u"#2997FF"
        for text, lv in (o.get(u"note") or []):
            tb = TextBlock()
            tb.Text = text
            tb.FontSize = 11.5
            tb.TextWrapping = TextWrapping.Wrap
            tb.Margin = Thickness(0, 0, 0, 4)
            if lv == u"ok":
                tb.Foreground = ann_brush(lime)
            else:
                tb.Foreground = isl_brush({u"warn": u"#FFD479", u"bad": u"#FF6B6B"}.get(lv, u"#8E8E93"))
            p.Children.Add(tb)

    def tkx_rpt_create(self):
        res = self._tkx_audit
        if not res:
            self.hdr_toast(u"Run the audit first")
            return
        o = self._tkx_rpt
        if o.get(u"where") == u"legend" and not res.get(u"legend0"):
            o[u"where"] = u"sheet"
        _fk = u"compact" if o.get(u"fmt") == u"compact" else u"full"
        _sel = o[u"sel"][_fk]
        if not any(_sel.get(k) and tkx_item_avail(res, k) for k, c, l in TK_RPT_ITEMS):
            o[u"note"] = [(u"Select at least one item in the list above.", u"warn")]
            self.tkx_rpt_opts_render()
            return
        o[u"note"] = [(u"Creating the report\u2026", u"info")]
        self.tkx_rpt_opts_render()
        self.ui_pump()
        self.run(self.tkx_report_to_model, "tkx_report_model")

    def tkx_rpt_note(self, lines):
        try:
            self._tkx_rpt[u"note"] = lines
            self.tkx_rpt_opts_render()
        except Exception as ex:
            tk_log(u"tkx_rpt_note: {}".format(ex))

    def tkx_report_to_model(self, uiapp_):
        ad = uiapp_.ActiveUIDocument
        d = ad.Document if ad else None
        res = self._tkx_audit
        o = dict(self._tkx_rpt)
        if d is None or d.IsFamilyDocument:
            self.tkx_rpt_note([])
            self.hdr_toast(u"Open an RVT project.")
            return
        if not res:
            self.tkx_rpt_note([])
            self.hdr_toast(u"Run the audit first")
            return
        if unicode(d.Title) != res[u"doc"]:
            self.tkx_rpt_note([])
            self.hdr_toast(u"The report is from another model ({}): run the audit for this one".format(tkx_short(res[u"doc"], 30)))
            return
        rfmt = u"compact" if o.get(u"fmt") == u"compact" else u"full"
        mode = o.get(u"where") if o.get(u"where") in (u"sheet", u"legend", u"drafting") else u"sheet"
        sel_now = (o.get(u"sel") or {}).get(rfmt)
        sched_which = set(k for k, v in (o.get(u"scheds") or {}).items() if v)
        want_sched = bool(sched_which) and rfmt == u"full"
        legends = []
        for v in FilteredElementCollector(d).OfClass(DB.View):
            try:
                if unicode(v.ViewType) == u"Legend" and not tkx_view_is_template(v):
                    legends.append(v)
            except Exception:
                pass
        notes = []
        if mode == u"legend" and not legends:
            mode = u"sheet"
            notes.append((u"The model has no legend: a sheet was created instead.", u"warn"))
        taken = set()
        for v in FilteredElementCollector(d).OfClass(DB.View):
            try:
                taken.add(unicode(v.Name))
            except Exception:
                pass
        stamp = time.strftime(u"%Y-%m-%d %H-%M", time.localtime(res[u"t"]))
        name = tkx_rpt_uniq(u"{} {}".format(TK_RPT_PREFIX if rfmt == u"full" else u"TK Metrics", stamp), taken)
        target, made, warn, berrs, sinfo = None, [], u"", [], []
        t = DB.Transaction(d, u"Toolkit: audit report")
        t.Start()
        try:
            if mode == u"legend":
                nid = legends[0].Duplicate(DB.ViewDuplicateOption.Duplicate)
                view = d.GetElement(nid)
                ids = []
                for e in FilteredElementCollector(d, view.Id):
                    try:
                        if not isinstance(e, DB.View):
                            ids.append(e.Id)
                    except Exception:
                        pass
                for eid in ids:
                    try:
                        d.Delete(eid)
                    except Exception:
                        pass
            else:
                vft = None
                for x in FilteredElementCollector(d).OfClass(DB.ViewFamilyType):
                    try:
                        if x.ViewFamily == DB.ViewFamily.Drafting:
                            vft = x
                            break
                    except Exception:
                        pass
                if vft is None:
                    raise Exception(u"The model has no drafting view type")
                view = DB.ViewDrafting.Create(d, vft.Id)
            for _i in range(1, 40):
                try:
                    view.Name = name if _i == 1 else u"{} ({})".format(name, _i)
                    break
                except Exception as ex_nm:
                    if _i >= 39:
                        raise Exception(u"could not name the view \"{}\": {}".format(name, ex_nm))
            name = view.Name
            taken.add(name)
            try:
                view.Scale = 1
            except Exception:
                pass
            w, h, berrs = tkx_rpt_build(d, view, res, rfmt, sel_now)
            target = view
            made.append(u"view \"{}\"".format(name))
            if mode == u"sheet":
                tb = tkx_rpt_title_block(d)
                tb_id = ElementId.InvalidElementId
                if tb is not None:
                    try:
                        if not tb.IsActive:
                            tb.Activate()
                        tb_id = tb.Id
                    except Exception:
                        pass
                sh = DB.ViewSheet.Create(d, tb_id)
                nums = set()
                for s in FilteredElementCollector(d).OfClass(DB.ViewSheet):
                    try:
                        nums.add(unicode(s.SheetNumber))
                    except Exception:
                        pass
                try:
                    sh.SheetNumber = tkx_rpt_uniq(u"TK-AUDIT", nums)
                except Exception:
                    pass
                try:
                    sh.Name = u"Toolkit Audit"
                except Exception:
                    pass
                cx, cy, ow, oh = 1.0, 0.7, 0.0, 0.0
                try:
                    ol = sh.Outline
                    cx, cy = (ol.Min.U + ol.Max.U) / 2.0, (ol.Min.V + ol.Max.V) / 2.0
                    ow, oh = ol.Max.U - ol.Min.U, ol.Max.V - ol.Min.V
                except Exception:
                    pass
                DB.Viewport.Create(d, sh.Id, view.Id, DB.XYZ(cx, cy, 0.0))
                target = sh
                made.append(u"sheet {}".format(sh.SheetNumber))
                if ow > 0 and (w > ow * 0.95 or h > oh * 0.95):
                    warn = u" \u00B7 the report is larger than the sheet size: change the title block size"
            if want_sched:
                sinfo = tkx_rpt_schedules(d, res, taken, stamp, sched_which)
            t.Commit()
        except Exception as ex:
            try:
                t.RollBack()
            except Exception:
                pass
            tk_log(u"tkx report: {}\n{}".format(ex, traceback.format_exc()))
            self.tkx_rpt_note([(u"Could not create the report, the changes were rolled back: " + err_text(ex), u"bad")])
            raise
        made_s = 0
        for e in sinfo:
            if e[u"skipped"]:
                notes.append((u"{}: nothing to list, the schedule was not created.".format(e[u"name"]), u"info"))
            elif e[u"err"]:
                notes.append((u"Schedule \u00AB{}\u00BB was not created: {}".format(e[u"name"], e[u"err"]), u"warn"))
            else:
                made_s += 1
                line = u"Schedule \u00AB{}\u00BB: {} rows.".format(e[u"name"], e[u"rows"] if e[u"rows"] is not None else u"?")
                bad = (e[u"exp"] is not None and e[u"rows"] is not None and e[u"rows"] != e[u"exp"])
                if bad:
                    line += u" The audit counted {}: check the filter of this schedule.".format(e[u"exp"])
                notes.append((line, u"warn" if bad else u"ok"))
                for sn in e[u"notes"]:
                    notes.append((sn, u"warn"))
        if made_s:
            made.append(u"{} schedule{}".format(made_s, u"" if made_s == 1 else u"s"))
        notes.insert(0, (u"Created: " + u", ".join(made) + warn, u"ok"))
        if berrs:
            notes.append((u"Some elements could not be drawn: " +
                          u"; ".join(u"{} \u00D7 {}".format(n, m) for m, n in berrs[:4]) +
                          u". Send this text so it can be fixed.", u"warn"))
        self.tkx_rpt_note(notes)
        try:
            ad.ActiveView = target
        except Exception as ex:
            tk_log(u"tkx report: ActiveView: {}".format(ex))
        self.hdr_toast(u"Created: " + u", ".join(made) + warn)

    # ------------------------------------------------------------ Command palette
    def tkx_on_key(self, s, e):
        try:
            from System.Windows.Input import Key, Keyboard, ModifierKeys
            m = Keyboard.Modifiers
            if e.Key == Key.K and (m & ModifierKeys.Control) == ModifierKeys.Control and (m & ModifierKeys.Alt) != ModifierKeys.Alt:
                e.Handled = True
                self.tkx_palette_open()
        except Exception as ex:
            tk_log(u"tkx_on_key: {}".format(ex))

    def tkx_hotkey_start(self):
        """Ctrl+K while the Revit or Toolkit window is active (GetAsyncKeyState polling, the key is not eaten)."""
        if not self.settings.get("palette_hotkey", True):
            return
        try:
            import ctypes
            self._tkx_u32 = ctypes.windll.user32
            self._tkx_revit = int(uiapp.MainWindowHandle.ToInt64())
        except Exception as ex:
            tk_log(u"tkx hotkey: {}".format(ex))
            return
        try:
            self._tkx_win_hwnd = int(WindowInteropHelper(self.win).Handle.ToInt64())
        except Exception:
            self._tkx_win_hwnd = 0
        t = DispatcherTimer()
        t.Interval = TimeSpan.FromMilliseconds(50)
        t.Tick += self.tkx_hotkey_tick
        self._tkx_hk_timer = t
        t.Start()

    def tkx_hotkey_tick(self, s, e):
        try:
            if self.closed:
                self._tkx_hk_timer.Stop()
                return
            u32 = self._tkx_u32
            down = bool(u32.GetAsyncKeyState(0x11) & 0x8000 and u32.GetAsyncKeyState(0x4B) & 0x8000
                        and not (u32.GetAsyncKeyState(0x12) & 0x8000) and not (u32.GetAsyncKeyState(0x10) & 0x8000))
            fire = down and not self._tkx_hk_down
            self._tkx_hk_down = down
            if not getattr(self, "_tkx_win_hwnd", 0) and self.win is not None:
                try:
                    self._tkx_win_hwnd = int(WindowInteropHelper(self.win).Handle.ToInt64())
                except Exception:
                    pass
            fg = int(u32.GetForegroundWindow() or 0)
            if fire and fg and (fg == self._tkx_revit or fg == getattr(self, "_tkx_win_hwnd", 0)) and self._tkx_pal is None:
                self.tkx_palette_open()
        except Exception:
            pass

    def tkx_hotkey_toggle(self):
        on = not self.settings.get("palette_hotkey", True)
        self.settings["palette_hotkey"] = on
        save_settings(self.settings)
        if on:
            self.tkx_hotkey_start()
        elif self._tkx_hk_timer is not None:
            self._tkx_hk_timer.Stop()
            self._tkx_hk_timer = None
        self.hdr_toast(u"Ctrl+K from the Revit window: " + (u"on" if on else u"off (works only in the Toolkit window)"))

    def tkx_commands(self):
        cmds = []

        def add(title, hint, glyph, kw, fn):
            cmds.append({u"title": title, u"hint": hint, u"glyph": glyph, u"kw": kw, u"fn": fn})

        def tab(rb):
            return lambda: setattr(rb, "IsChecked", True)
        add(u"Datum: Sign in / Account", u"Datum", u"\uE77B", u"datum login auth account user", lambda: self.tkx_datum_open_login())
        add(u"Datum: Open 3D Assemblies", u"Datum 3D", u"\uE81E", u"datum 3d assembly shaft partition wall", lambda: datum_open_url(u"/?view=3d"))
        add(u"Datum: Open Detail Wall", u"Datum", u"\uE8B9", u"datum detail wall diagrams standards", lambda: datum_open_url(u"/?view=wall"))
        add(u"Home", u"tab", u"\uE80F", u"home main", tab(self.tabHome))
        add(u"Print Sets", u"tab", u"\uE749", u"print sets sheets export pdf dwg print", tab(self.tabPrint))
        if TK_ENABLE_NM:
            add(u"Views: naming", u"tab", u"\uE8A5", u"views names template views naming", tab(self.tabNm))
        if TK_ENABLE_TILE:
            add(u"Params", u"tab", u"\uE80A", u"parameters table elements tile params", tab(self.tabTile))
        add(u"Annotations", u"tab", u"\uE8EC", u"annotations library annotations", tab(self.tabAnn))
        add(u"Modules", u"tab", u"\uE943", u"scripts modules py", tab(self.tabMod))
        add(u"Align Elevation markers", u"tool", u"\uE7AD", u"snap elevation marker angle align",
            lambda: self.tools_go("snapmarkers"))
        add(u"Move marker (crop stays)", u"tool", u"\uE7C2", u"move marker elevation nudge",
            lambda: self.tools_go("movemarker"))
        add(u"View \u2192 Sheet", u"tool", u"\uE722", u"view sheet elevation section plan view sheet",
            lambda: self.tools_go("viewmaker"))
        add(u"Annotations strip", u"show / hide", u"\uE8A7", u"annotation bar strip", self.ann_bar_toggle)
        add(u"Model audit", u"Home", u"\uE7BA", u"audit health warnings imports filters model health",
            lambda: (setattr(self.tabHome, "IsChecked", True), self.tkx_audit_start()))
        add(u"Deep model audit", u"Home", u"\uE9D9", u"deep audit all views check full",
            lambda: (setattr(self.tabHome, "IsChecked", True), self.tkx_audit_start_deep()))
        add(u"Audit report to model (legend / sheet)", u"Home", u"\uE8A5", u"audit report legend sheet model schedule",
            lambda: (setattr(self.tabHome, "IsChecked", True), self.tkx_report_model_open()))
        add(u"Copy audit report", u"clipboard", u"\uE8C8", u"audit report", self.tkx_audit_copy)
        add(u"Clear audit highlight", u"Home", u"\uE894", u"audit highlight clear reset selection box colour", self.tkx_hl_clear_req)
        add(u"Copy error report", u"clipboard", u"\uE8C8", u"error report crash traceback error failure",
            self.tkx_copy_report)
        add(u"Undo the last tool action (Undo)", u"action log", u"\uE7A7", u"undo revert rollback",
            self.tkx_undo_last)
        add(u"Export settings\u2026", u"JSON", u"\uE898", u"export settings save", self.tkx_export_settings)
        add(u"Import settings\u2026", u"JSON", u"\uE896", u"import settings load", self.tkx_import_settings)
        add(u"Refresh project data", u"", u"\uE72C", u"refresh reindex update", self.request_reindex)
        add(u"Workspace: save open views\u2026", u"workspace", u"\uE74E", u"workspace save session tabs views", self.tkx_ws_save_start)
        try:
            for w in sorted(self.tkx_ws_spaces(), key=lambda x: -x.get(u"t", 0))[:30]:
                add(u"Workspace: " + w.get(u"name", u"?"), u"restore", u"\uE8A9", u"workspace restore session tabs open views",
                    lambda wid=w[u"id"]: self.tkx_ws_restore(wid))
        except Exception:
            pass
        add(u"Workspace: close other tabs on restore, on / off", u"settings", u"\uE8BB", u"workspace close tabs", self.tkx_ws_toggle_close)
        add(u"Copy Revit link: active view / sheet", u"link", u"\uE71B", u"link copy url share view sheet teams slack", lambda: self.tkx_lk_copy(u"view"))
        add(u"Copy Revit link: selected element", u"link", u"\uE71B", u"link copy url share element selection teams slack", lambda: self.tkx_lk_copy(u"sel"))
        add(u"Revit links (utk://): on / off", u"settings", u"\uE713", u"link protocol register utk", self.tkx_lk_toggle)
        add(u"Revit links: web redirect page\u2026", u"settings", u"\uE774", u"link web https redirect teams slack", self.tkx_lk_set_web)
        add(u"Rebuild the model search index", u"Ctrl+K", u"\uE72C", u"index spotlight search reindex views sheets rooms", lambda: self.tkx_sp_request(True))
        add(u"Collapse Toolkit", u"", u"\uE70D", u"compact collapse pill minimize icon island", lambda: self.island_collapse())
        add(u"Ctrl+K from the Revit window: on / off", u"settings", u"\uE713", u"hotkey palette shortcut", self.tkx_hotkey_toggle)
        try:
            for n in sorted(self.sets.keys(), key=nat)[:150]:
                add(u"Set: " + n, u"open print set", u"\uE749", u"set print sheet set", lambda nn=n: self.home_open_set(nn))
        except Exception:
            pass
        return cmds

    def tkx_undo_last(self):
        for rec in reversed(self._tkx_log):
            if self.tkx_can_undo(rec):
                self.tkx_undo(rec)
                return
        self.hdr_toast(u"Nothing to undo: the last model change was not made through Toolkit")

    def tkx_palette_open(self):
        tk_log(u"tkx_palette_open: start")
        if self.closed:
            return
        if self._tkx_pal is not None:
            try:
                self._tkx_pal.Activate()
                return
            except Exception:
                self._tkx_pal = None
        try:
            pal = load_xaml(TKX_PAL_XAML, isl=True)
        except Exception as ex:
            tk_log(u"tkx_palette_open xaml ERR: {}\n{}".format(ex, traceback.format_exc()))
            self.note_error(u"Palette", ex, traceback.format_exc())
            return
        try:
            WindowInteropHelper(pal).Owner = uiapp.MainWindowHandle
        except Exception as ex:
            tk_log(u"palette owner: {}".format(ex))
        names = {}
        for n in (u"palQ", u"palHint", u"palSv", u"palList", u"palQuick"):
            names[n] = pal.FindName(n)
        sel_ctx = datum_read_selection(uiapp)
        d_cfg = datum_get_cfg()
        st = {
            u"cmds": self.tkx_commands(),
            u"shown": [],
            u"idx": 0,
            u"datum_rows": [],
            u"datum_pending": None,
            u"datum_seq": 0,
            u"sel_ctx": sel_ctx,
            u"poll_timer": None,
        }
        self._tkx_pal = pal
        self._tkx_pal_ready = False
        try:
            from System.Windows import SystemParameters
            wa = SystemParameters.WorkArea
            pal.Left = wa.Left + (wa.Width - 620.0) / 2.0
            pal.Top = wa.Top + wa.Height * 0.16
        except Exception:
            pass
        q = names[u"palQ"]
        if sel_ctx.get("label"):
            names[u"palHint"].Text = u"Search Revit or Datum | Selected: {}".format(sel_ctx["label"])
        elif d_cfg.get(u"user"):
            names[u"palHint"].Text = u"Search Revit or Datum | Signed in as {}".format(d_cfg[u"user"])
        bind_hint(q, names[u"palHint"])

        # ---- bottom panel: quick buttons (add new ones to the `quick` list) ----
        def quick_run(fn):
            self.tkx_palette_close()
            try:
                fn()
            except Exception as ex:
                tk_log(u"palette quick: {}\n{}".format(ex, traceback.format_exc()))
                self.note_error(u"Command palette", ex, traceback.format_exc())

        def chip(glyph, text, fn, accent=u"#2997FF"):
            bd = Border()
            bd.CornerRadius = CornerRadius(10)
            bd.Padding = Thickness(10, 6, 12, 6)
            bd.Margin = Thickness(0, 0, 8, 8)
            bd.Cursor = AnnCursors.Hand
            bd.Background = isl_brush(u"#2C2C2E")
            sp = StackPanel()
            sp.Orientation = Orientation.Horizontal
            ic = TextBlock()
            ic.Text = glyph
            ic.FontFamily = ICON_FONT
            ic.FontSize = 13.0
            ic.Foreground = isl_brush(accent)
            ic.VerticalAlignment = VerticalAlignment.Center
            ic.Margin = Thickness(0, 0, 7, 0)
            sp.Children.Add(ic)
            sp.Children.Add(self.tkx_text(text, 12.5, u"#F5F5F7"))
            bd.Child = sp
            bd.MouseEnter += lambda s, e: setattr(s, "Background", isl_brush(u"#3A3A3C"))
            bd.MouseLeave += lambda s, e: setattr(s, "Background", isl_brush(u"#2C2C2E"))
            bd.MouseLeftButtonUp += lambda s, e: (setattr(e, "Handled", True), quick_run(fn))
            return bd

        datum_label = (u"Datum: " + d_cfg[u"user"]) if d_cfg.get(u"user") else u"Sign in to Datum"
        quick = [
            (u"\uE77B", datum_label, lambda: self.tkx_datum_open_login(), u"#2997FF"),
            (u"\uE81E", u"3D Assemblies", lambda: datum_open_url(u"/?view=3d"), u"#5E5CE6"),
            (u"\uE71B", u"Copy link: view / sheet", lambda: self.tkx_lk_copy(u"view"), u"#2997FF"),
            (u"\uE71B", u"Copy link: element", lambda: self.tkx_lk_copy(u"sel"), u"#2997FF"),
        ]
        for g_, t_, f_, ac_ in quick:
            names[u"palQuick"].Children.Add(chip(g_, t_, f_, ac_))

        def datum_type_row(ctx):
            tn = (ctx or {}).get("typeName") or (ctx or {}).get("family") or (ctx or {}).get("category")
            if not tn:
                return None
            cat = (ctx or {}).get("category") or u"Revit"
            fam = (ctx or {}).get("family") or u""
            sub_parts = [x for x in (cat, fam) if x]
            sub_txt = u" · ".join(sub_parts) + u" — Open type page & relative items in Datum"
            t_url = datum_type_url(ctx)
            return {
                u"title": unicode(tn),
                u"sub": sub_txt,
                u"hint": u"Revit Type",
                u"glyph": u"\uE8A5",
                u"accent": u"#0A84FF",
                u"kw": u"datum revit type standard " + unicode(tn).lower(),
                u"fn": (lambda u=t_url: datum_open_url(u)),
            }

        def fetch_datum(query_text):
            st[u"datum_seq"] += 1
            seq = st[u"datum_seq"]

            def worker():
                rows = []
                q_clean = (query_text or u"").strip()
                tr = datum_type_row(st[u"sel_ctx"])
                if tr is not None:
                    rows.append(tr)
                try:
                    res = datum_lookup(st[u"sel_ctx"], query_text)
                    if res and res.get("ok"):
                        if q_clean:
                            for asm in (res.get("assembly3d") or []):
                                rows.append({
                                    u"title": u"3D Assembly: " + unicode(asm.get("title", "")),
                                    u"sub": u"{} | {} | {} | {} layers".format(
                                        asm.get("code", ""), asm.get("fireRating", ""), asm.get("stc", ""), asm.get("layersCount", 0)
                                    ),
                                    u"hint": u"Datum 3D",
                                    u"glyph": u"\uE81E",
                                    u"accent": u"#5E5CE6",
                                    u"kw": u"datum 3d assembly",
                                    u"fn": (lambda u=asm.get("url", "/?view=3d"): datum_open_url(u)),
                                })
                        for std in (res.get("standards") or []):
                            rules = std.get("keyRules") or []
                            sub = rules[0] if rules else (std.get("summary") or u"")
                            rows.append({
                                u"title": unicode(std.get("title", "")),
                                u"sub": unicode(sub[:115]),
                                u"hint": u"Relative · {}".format(std.get("disc", "BIM")) if not q_clean else u"Datum | {}".format(std.get("disc", "BIM")),
                                u"glyph": u"\uE8A5",
                                u"accent": u"#2997FF",
                                u"kw": u"datum standard",
                                u"fn": (lambda u=std.get("url", "/"): datum_open_url(u)),
                            })
                except Exception as ex:
                    tk_log(u"datum_lookup: {}".format(ex))
                st[u"datum_pending"] = (seq, rows)

            try:
                from System.Threading import Thread as NetThread, ThreadStart as NetThreadStart
                t = NetThread(NetThreadStart(worker))
                t.IsBackground = True
                t.Start()
            except Exception as ex:
                tk_log(u"datum thread err: {}".format(ex))

        def poll_tick(s, e):
            pend = st[u"datum_pending"]
            if pend is None:
                return
            st[u"datum_pending"] = None
            seq, rows = pend
            if seq == st[u"datum_seq"] and self._tkx_pal is pal:
                st[u"datum_rows"] = rows
                render(skip_fetch=True)

        poll_tm = DispatcherTimer()
        poll_tm.Interval = TimeSpan.FromMilliseconds(50)
        poll_tm.Tick += poll_tick
        st[u"poll_timer"] = poll_tm
        poll_tm.Start()

        def render(skip_fetch=False):
            lst = names[u"palList"]
            lst.Children.Clear()
            query = (q.Text or u"").strip()
            if not skip_fetch:
                fetch_datum(query)
            local_rows = self.tkx_sp_rows(query, st[u"cmds"])
            d_rows = [] if query.startswith(u">") else (st[u"datum_rows"] or [])
            st[u"shown"] = (d_rows[:6] + local_rows)[:40]
            st[u"idx"] = 0
            for i, c in enumerate(st[u"shown"]):
                lst.Children.Add(row(i, c))
            if not st[u"shown"]:
                lst.Children.Add(self.tkx_text(u"Nothing found", 12, u"#8E8E93", margin=Thickness(12, 8, 12, 8)))
            mark()

        def row(i, c):
            bd = Border()
            bd.CornerRadius = CornerRadius(12)
            bd.Padding = Thickness(12, 8, 12, 8)
            bd.Cursor = AnnCursors.Hand
            bd.Background = Brushes.Transparent
            bd.Tag = i
            dp = DockPanel()
            hint = self.tkx_text(c[u"hint"], 11, c.get(u"accent") or u"#8E8E93")
            hint.VerticalAlignment = VerticalAlignment.Center
            DockPanel.SetDock(hint, Dock.Right)
            dp.Children.Add(hint)
            ic = TextBlock()
            ic.Text = c[u"glyph"]
            ic.FontFamily = ICON_FONT
            ic.FontSize = 14.0
            ic.Width = 26.0
            ic.Foreground = isl_brush(c.get(u"accent") or u"#C7C7CC")
            ic.VerticalAlignment = VerticalAlignment.Center
            dp.Children.Add(ic)
            if c.get(u"sub"):
                sp_txt = StackPanel()
                sp_txt.Children.Add(self.tkx_text(c[u"title"], 13.5, u"#F5F5F7"))
                sub_tb = self.tkx_text(c[u"sub"], 11.2, u"#AEAEB2")
                sub_tb.TextTrimming = TextTrimming.CharacterEllipsis
                sp_txt.Children.Add(sub_tb)
                dp.Children.Add(sp_txt)
            else:
                dp.Children.Add(self.tkx_text(c[u"title"], 13.5, u"#F5F5F7"))
            bd.Child = dp
            bd.MouseEnter += lambda s, e, k=i: (st.__setitem__(u"idx", k), mark())
            bd.MouseLeftButtonUp += lambda s, e, k=i: (setattr(e, "Handled", True), run_idx(k))
            return bd

        def mark():
            lst = names[u"palList"]
            for k in range(lst.Children.Count):
                ch = lst.Children[k]
                if isinstance(ch, Border):
                    ch.Background = isl_brush(u"#2C2C2E") if k == st[u"idx"] else Brushes.Transparent
            try:
                if 0 <= st[u"idx"] < lst.Children.Count:
                    lst.Children[st[u"idx"]].BringIntoView()
            except Exception:
                pass

        def run_idx(k):
            if not (0 <= k < len(st[u"shown"])):
                return
            fn = st[u"shown"][k][u"fn"]
            self.tkx_palette_close()
            try:
                fn()
            except Exception as ex:
                tk_log(u"palette cmd: {}\n{}".format(ex, traceback.format_exc()))
                self.note_error(u"Command palette", ex, traceback.format_exc())

        def on_key(s, e):
            k = str(e.Key)
            if k == u"Escape":
                e.Handled = True
                self.tkx_palette_close()
            elif k in (u"Down", u"Up"):
                e.Handled = True
                n = len(st[u"shown"])
                if n:
                    st[u"idx"] = (st[u"idx"] + (1 if k == u"Down" else -1)) % n
                    mark()
            elif k in (u"Return", u"Enter"):
                e.Handled = True
                from System.Windows.Input import Keyboard, ModifierKeys
                it = st[u"shown"][st[u"idx"]].get(u"item") if 0 <= st[u"idx"] < len(st[u"shown"]) else None
                if it is not None and (Keyboard.Modifiers & ModifierKeys.Shift) == ModifierKeys.Shift:
                    self.tkx_palette_close()
                    self.tkx_sp_copy(it)
                else:
                    run_idx(st[u"idx"])

        def on_activated(s, e):
            self._tkx_pal_ready = True

        def on_deactivated(s, e):
            if self._tkx_pal_ready:
                self.tkx_later(self.tkx_palette_close, 30)
        pal.PreviewKeyDown += on_key
        pal.Activated += on_activated
        pal.Deactivated += on_deactivated
        def on_closed(s, e):
            setattr(self, "_tkx_pal", None)
            try:
                if st[u"poll_timer"] is not None:
                    st[u"poll_timer"].Stop()
            except Exception:
                pass
        pal.Closed += on_closed
        q.TextChanged += lambda s, e: render()
        self._tkx_pal_render = render
        self.tkx_sp_ensure()
        render(skip_fetch=True)
        pal.Show()
        pal.Activate()
        q.Focus()
        fetch_datum(u"")

    def tkx_palette_close(self):
        pal = self._tkx_pal
        self._tkx_pal = None
        self._tkx_pal_ready = False
        if pal is not None:
            try:
                pal.Close()
            except Exception:
                pass

    # ------------------------------------------------- Workspaces · Spotlight · Revit links
    def tkx_wl_setup(self):
        for n in (u"tbWsInfo", u"pnlWsBtns", u"pnlWsList"):
            setattr(self, n, self.win.FindName(n))
        self._tkx_wsdata = tkw_ws_load()
        self._tkx_ws_doc = object()          # sentinel: the first render reads the model key
        self._tkx_ws_dirty = True
        self._tkx_mkey = u""
        self._tkx_sp = None                  # spotlight index of the active model
        self._tkx_sp_busy = False
        self._tkx_sp_dirty = True
        self._tkx_pal_render = None
        self._tkx_lk_timer = None
        if self.settings.get("link_register", True):
            try:
                if not tkw_reg_ok():
                    tkw_reg_install()
                    tk_log(u"links: utk:// registered for the current user")
            except Exception as ex:
                tk_log(u"links: registration failed: {}".format(ex))
        try:
            t = DispatcherTimer()
            t.Interval = TimeSpan.FromMilliseconds(600)
            t.Tick += self.tkx_lk_tick
            self._tkx_lk_timer = t
            t.Start()
            tk_log(u"links: listener started (build 2026-11-12b), dir {}".format(TKW_LINK_DIR))
        except Exception as ex:
            tk_log(u"links: timer: {}".format(ex))

    def tkx_wl_shutdown(self):
        try:
            if self._tkx_lk_timer is not None:
                self._tkx_lk_timer.Stop()
        except Exception:
            pass

    def tkx_icon_btn(self, glyph, tip, action, warn=False):
        bd = Border()
        bd.Width = 26.0
        bd.Height = 26.0
        bd.CornerRadius = CornerRadius(13)
        bd.Margin = Thickness(6, 0, 0, 0)
        bd.Cursor = AnnCursors.Hand
        bd.Background = isl_brush(u"#2C2C2E")
        bd.ToolTip = tip
        ic = TextBlock()
        ic.Text = glyph
        ic.FontFamily = ICON_FONT
        ic.FontSize = 12.0
        ic.Foreground = isl_brush(u"#FF6B6B" if warn else u"#F5F5F7")
        ic.HorizontalAlignment = TkwHA.Center
        ic.VerticalAlignment = VerticalAlignment.Center
        bd.Child = ic
        bd.MouseEnter += lambda s, e: setattr(bd, "Background", isl_brush(u"#3A3A3C"))
        bd.MouseLeave += lambda s, e: setattr(bd, "Background", isl_brush(u"#2C2C2E"))
        bd.MouseLeftButtonUp += lambda s, e: (setattr(e, "Handled", True), action())
        return bd

    def tkx_wl_owner(self):
        try:
            return self.win if self.win.IsVisible else None
        except Exception:
            return None

    # ---------------- workspaces
    def tkx_ws_spaces(self):
        m = self._tkx_wsdata.get(u"models", {}).get(self._tkx_mkey or u"")
        return m[u"spaces"] if m else []

    def tkx_ws_render(self):
        if self.pnlWsList is None:
            return
        if self._tkx_ws_doc != self.doc_title:
            self._tkx_ws_doc = self.doc_title
            self.run(self.tkx_ws_keyjob, None)          # the model key is read in the Revit context; it draws the card
            return
        if self._tkx_ws_dirty:
            self.tkx_ws_draw()

    def tkx_ws_keyjob(self, ua):
        ad = ua.ActiveUIDocument
        self._tkx_mkey = tkw_model_key(ad.Document) if ad is not None else u""
        self._tkx_ws_dirty = True
        self.tkx_ws_draw()

    def tkx_ws_draw(self):
        if self.pnlWsList is None:
            return
        self._tkx_ws_dirty = False
        b, p = self.pnlWsBtns, self.pnlWsList
        b.Children.Clear()
        p.Children.Clear()
        spaces = self.tkx_ws_spaces()
        self.tbWsInfo.Text = (u"Save the open views with their zoom and bring them back in one click, also tomorrow. "
                              u"Links open a view, sheet or element for a colleague who has Toolkit running.")
        b.Children.Add(self.home_chip(u"Save open views", u"\uE74E", self.tkx_ws_save_start, accent=True,
                                      tip=u"Remember all open views of this model (zoom and the active view)"))
        b.Children.Add(self.home_chip(u"Link to view", u"\uE71B", lambda: self.tkx_lk_copy(u"view"),
                                      tip=u"Copy a Revit link to the active view or sheet"))
        b.Children.Add(self.home_chip(u"Link to selection", u"\uE71B", lambda: self.tkx_lk_copy(u"sel"),
                                      tip=u"Copy a Revit link to the selected element (opens in the current view)"))
        co = bool(self.settings.get("ws_close_others", False))
        b.Children.Add(self.home_chip(u"Close other tabs: " + (u"on" if co else u"off"), u"\uE8BB", self.tkx_ws_toggle_close,
                                      tip=u"When a workspace is restored, close the view tabs that are not in it"))
        for ws in sorted(spaces, key=lambda w: -w.get(u"t", 0)):
            p.Children.Add(self.tkx_ws_row(ws))

    def tkx_ws_row(self, ws):
        wid = ws[u"id"]
        bd = Border()
        bd.CornerRadius = CornerRadius(14)
        bd.Padding = Thickness(12, 8, 8, 8)
        bd.Margin = Thickness(0, 0, 8, 6)
        bd.Cursor = AnnCursors.Hand
        bd.Background = isl_brush(u"#1C1C1E")
        dp = DockPanel()
        sp = StackPanel()
        sp.Orientation = Orientation.Horizontal
        DockPanel.SetDock(sp, Dock.Right)
        sp.Children.Add(self.tkx_icon_btn(u"\uE72C", u"Update from the views open now", lambda w=wid: self.tkx_ws_update(w)))
        sp.Children.Add(self.tkx_icon_btn(u"\uE74D", u"Delete the workspace", lambda w=wid: self.tkx_ws_delete(w), warn=True))
        dp.Children.Add(sp)
        left = StackPanel()
        left.Children.Add(self.tkx_text(ws.get(u"name", u"?"), 13, u"#F5F5F7", bold=True))
        try:
            when = time.strftime(u"%d.%m %H:%M", time.localtime(ws.get(u"t", 0)))
        except Exception:
            when = u""
        left.Children.Add(self.tkx_text(u"{} views \u00B7 {}".format(len(ws.get(u"views", [])), when), 11, u"#8E8E93"))
        dp.Children.Add(left)
        bd.Child = dp
        bd.ToolTip = u"Restore"
        bd.MouseEnter += lambda s, e: setattr(bd, "Background", isl_brush(u"#2C2C2E"))
        bd.MouseLeave += lambda s, e: setattr(bd, "Background", isl_brush(u"#1C1C1E"))
        bd.MouseLeftButtonUp += lambda s, e, w=wid: (setattr(e, "Handled", True), self.tkx_ws_restore(w))
        return bd

    def tkx_ws_toggle_close(self):
        self.settings["ws_close_others"] = not bool(self.settings.get("ws_close_others", False))
        save_settings(self.settings)
        self._tkx_ws_dirty = True
        self.tkx_ws_draw()

    def tkx_ws_save_start(self):
        name = ask_string(self.tkx_wl_owner(), u"Save workspace",
                          u"Name, for example: Unit 2629 \u2013 review",
                          time.strftime(u"Workspace %d.%m %H:%M"))
        name = (name or u"").strip()
        if not name:
            return
        self.run(lambda ua, n=name: self.tkx_ws_do_save(ua, n, None), None)

    def tkx_ws_update(self, wid):
        self.run(lambda ua, w=wid: self.tkx_ws_do_save(ua, None, w), None)

    def tkx_ws_do_save(self, ua, name, wid):
        ad = ua.ActiveUIDocument
        if ad is None:
            return self.hdr_toast(u"No model is open")
        d = ad.Document
        key = tkw_model_key(d)
        cur = ad.ActiveView.UniqueId
        views = []
        for uv in ad.GetOpenUIViews():
            v = d.GetElement(uv.ViewId)
            if v is None or not isinstance(v, DB.View):
                continue
            corners = None
            try:
                c = uv.GetZoomCorners()
                corners = [c[0].X, c[0].Y, c[0].Z, c[1].X, c[1].Y, c[1].Z]
            except Exception:
                pass
            views.append({u"u": v.UniqueId, u"n": unicode(v.Name), u"c": corners})
        if not views:
            return self.hdr_toast(u"No open views to save")
        data = self._tkx_wsdata
        m = data[u"models"].setdefault(key, {u"title": unicode(d.Title), u"spaces": []})
        m[u"title"] = unicode(d.Title)
        target = None
        for w in m[u"spaces"]:
            if (wid and w[u"id"] == wid) or (name and w.get(u"name") == name):
                target = w
        if target is None:
            target = {u"id": uuid.uuid4().hex[:8], u"name": name}
            m[u"spaces"].append(target)
        target[u"views"], target[u"a"], target[u"t"] = views, cur, time.time()
        self._tkx_mkey = key
        if not tkw_ws_save(data):
            self.hdr_toast(u"Could not write workspaces.json (see toolkit_debug.log)")
        self._tkx_ws_dirty = True
        self.tkx_ws_draw()
        self.hdr_toast(u"Workspace \u00AB{}\u00BB: {} views".format(target[u"name"], len(views)))

    def tkx_ws_restore(self, wid):
        self.run(lambda ua, w=wid: self.tkx_ws_do_restore(ua, w), None)

    def tkx_ws_do_restore(self, ua, wid):
        ad = ua.ActiveUIDocument
        if ad is None:
            return
        d = ad.Document
        m = self._tkx_wsdata.get(u"models", {}).get(tkw_model_key(d))
        ws = None
        for w in (m[u"spaces"] if m else []):
            if w[u"id"] == wid:
                ws = w
        if ws is None:
            return self.hdr_toast(u"This workspace belongs to another model")
        opened, missing, keep, active = 0, 0, set(), None
        for e in ws.get(u"views", []):
            v = d.GetElement(e[u"u"])
            if v is None or not isinstance(v, DB.View) or v.IsTemplate:
                missing += 1
                continue
            try:
                ad.ActiveView = v
            except Exception:
                try:
                    ad.RequestViewChange(v)
                except Exception:
                    missing += 1
                    continue
            opened += 1
            keep.add(id_value(v.Id))
            c = e.get(u"c")
            if c and len(c) == 6:
                for uv in ad.GetOpenUIViews():
                    if id_value(uv.ViewId) == id_value(v.Id):
                        try:
                            uv.ZoomAndCenterRectangle(DB.XYZ(c[0], c[1], c[2]), DB.XYZ(c[3], c[4], c[5]))
                        except Exception as ex:
                            tk_log(u"workspace zoom: {}".format(ex))
                        break
            if e[u"u"] == ws.get(u"a"):
                active = v
        if active is not None:
            try:
                ad.ActiveView = active
            except Exception:
                pass
        closed = 0
        if self.settings.get("ws_close_others", False) and opened:
            for uv in list(ad.GetOpenUIViews()):
                if id_value(uv.ViewId) not in keep:
                    try:
                        uv.Close()
                        closed += 1
                    except Exception:
                        pass
        msg = u"Workspace \u00AB{}\u00BB: {} views".format(ws.get(u"name"), opened)
        if missing:
            msg += u", {} no longer exist".format(missing)
        if closed:
            msg += u", {} tabs closed".format(closed)
        self.hdr_toast(msg)

    def tkx_ws_delete(self, wid):
        ws = [w for w in self.tkx_ws_spaces() if w[u"id"] == wid]
        if not ws:
            return
        if not confirm(self.tkx_wl_owner(), u"Delete the workspace \u00AB{}\u00BB?".format(ws[0].get(u"name")), u"Workspaces"):
            return
        m = self._tkx_wsdata[u"models"].get(self._tkx_mkey)
        m[u"spaces"] = [w for w in m[u"spaces"] if w[u"id"] != wid]
        tkw_ws_save(self._tkx_wsdata)
        self._tkx_ws_dirty = True
        self.tkx_ws_draw()

    # ---------------- navigation helpers (Revit context)
    def tkx_go_view(self, ad, view):
        if not isinstance(view, DB.View) or view.IsTemplate:
            return False
        ad.RequestViewChange(view)          # asynchronous and safe inside an external event
        return True

    def tkx_go_element(self, ad, el, view=None):
        uid = el.UniqueId
        delay = 60
        if view is not None and isinstance(view, DB.View) and not view.IsTemplate:
            try:
                if id_value(ad.ActiveView.Id) != id_value(view.Id):
                    ad.RequestViewChange(view)
                    delay = 700
            except Exception as ex:
                tk_log(u"go element view: {}".format(ex))
        self.tkx_later(lambda: self.run(lambda ua, u=uid: self.tkx_show_el(ua, u), None), delay)

    def tkx_show_el(self, ua, uid):
        ad = ua.ActiveUIDocument
        el = ad.Document.GetElement(uid) if ad is not None else None
        if el is None:
            return
        try:
            ad.Selection.SetElementIds(List[ElementId]([el.Id]))
        except Exception as ex:
            tk_log(u"go element select: {}".format(ex))
        try:
            ad.ShowElements(el.Id)
        except Exception as ex:
            tk_log(u"go element show: {}".format(ex))

    def tkx_go_room(self, ad, room):
        d = ad.Document
        target = None
        try:
            av = ad.ActiveView
            if isinstance(av, DB.ViewPlan) and not av.IsTemplate and av.GenLevel is not None \
                    and id_value(av.GenLevel.Id) == id_value(room.LevelId):
                target = av
            if target is None:
                for v in FilteredElementCollector(d).OfClass(DB.ViewPlan):
                    if v.IsTemplate or v.ViewType != DB.ViewType.FloorPlan:
                        continue
                    if v.GenLevel is not None and id_value(v.GenLevel.Id) == id_value(room.LevelId):
                        target = v
                        break
        except Exception as ex:
            tk_log(u"go room: {}".format(ex))
        self.tkx_go_element(ad, room, target)

    # ---------------- spotlight
    def tkx_sp_pnames(self):
        out = []
        for n in list(BROWSER_PARAMS) + list(self.settings.get("spot_params") or []) + TKW_SP_PARAMS:
            if isinstance(n, basestring) and n and n not in out:
                out.append(n)
        return out

    def tkx_sp_ensure(self):
        sp = self._tkx_sp
        stale = sp is None or sp.get(u"title") != self.doc_title
        if stale or (self._tkx_sp_dirty and time.time() - sp.get(u"t", 0) > 30):
            self.tkx_sp_request()

    def tkx_sp_request(self, force=False):
        if self._tkx_sp_busy or self.closed:
            return
        self._tkx_sp_busy = True
        self.run(self.tkx_sp_job, None)

    def tkx_sp_job(self, ua):
        try:
            ad = ua.ActiveUIDocument
            if ad is None:
                self._tkx_sp = None
                return
            t0 = time.time()
            d = ad.Document
            items, trunc = tkw_sp_collect(d, self.tkx_sp_pnames())
            self._tkx_sp = {u"title": unicode(d.Title),
                            u"key": tkw_model_key(d), u"items": items, u"t": time.time(), u"trunc": trunc}
            self._tkx_sp_dirty = False
            tk_log(u"spotlight: {} items in {:.1f} s{}".format(len(items), time.time() - t0, u" (truncated)" if trunc else u""))
        except Exception as ex:
            tk_log(u"spotlight index: {}\n{}".format(ex, traceback.format_exc()))
        finally:
            self._tkx_sp_busy = False
        try:
            if self._tkx_pal is not None and self._tkx_pal_render is not None:
                self._tkx_pal_render()
        except Exception as ex:
            tk_log(u"spotlight refresh: {}".format(ex))

    def tkx_sp_row(self, it, query):
        toks = [x for x in tkx_layouts(query)[0].split() if x]
        hint = it[u"s"]
        for pn, pv in it[u"p"]:
            if any(t in pv.lower() for t in toks):
                hint = u"{}: {} \u00B7 {}".format(pn, pv, it[u"s"])
                break
        glyph = {u"sheet": u"\uE7C3", u"room": u"\uE80F"}.get(it[u"k"], u"\uE8A9")
        return {u"title": it[u"t"], u"hint": hint[:48], u"glyph": glyph, u"kw": u"",
                u"fn": (lambda i=it: self.tkx_sp_go(i)), u"item": it}

    def tkx_sp_rows(self, query, cmds):
        q = query
        only_cmd = q.startswith(u">")
        if only_cmd:
            q = q[1:].strip()
        crow = []
        for c in cmds:
            sc = tkx_match(q, c[u"title"] + u" " + c[u"kw"]) if q else 0.0
            if sc is not None:
                crow.append((sc, c))
        if not q:
            return [c for _, c in crow][:40]
        crow.sort(key=lambda r: -r[0])
        cl = [c for _, c in crow]
        if only_cmd:
            return cl[:40]
        sp = self._tkx_sp
        ready = sp is not None and sp.get(u"title") == self.doc_title
        rows = [self.tkx_sp_row(it, q) for it in tkw_sp_search(sp[u"items"], q, 30)] if ready else []
        toks = [x for x in tkx_layouts(q)[0].split() if x]
        strong = [c for c in cl if all(t in c[u"title"].lower() for t in toks)]
        if any(ch.isdigit() for ch in q) or not strong:
            out = rows[:30] + cl[:10]
        else:
            out = strong[:8] + rows[:26] + [c for c in cl if c not in strong][:6]
        if not ready:
            out.append({u"title": u"Indexing the model for search\u2026", u"hint": u"", u"glyph": u"\uE895", u"kw": u"",
                        u"fn": (lambda: None)})
        return out[:40]

    def tkx_sp_go(self, it):
        self.run(lambda ua, i=it: self.tkx_sp_do_go(ua, i), None)

    def tkx_sp_do_go(self, ua, it):
        ad = ua.ActiveUIDocument
        if ad is None:
            return
        d = ad.Document
        el = d.GetElement(it[u"u"])
        if el is None:
            self._tkx_sp_dirty = True
            self.tkx_sp_request()
            return self.hdr_toast(u"Not found: the model has changed. The search index is being refreshed")
        if it[u"k"] in (u"view", u"sheet"):
            self.tkx_go_view(ad, el)
        else:
            self.tkx_go_room(ad, el)

    def tkx_sp_copy(self, it):
        self.run(lambda ua, i=it: self.tkx_lk_do_copy(ua, None, i), None)

    # ---------------- revit links
    def tkx_lk_copy(self, what):
        self.run(lambda ua, w=what: self.tkx_lk_do_copy(ua, w, None), None)

    def tkx_lk_do_copy(self, ua, what, item):
        ad = ua.ActiveUIDocument
        if ad is None:
            return self.hdr_toast(u"No model is open")
        d = ad.Document
        kind = name = uid = vuid = None
        if item is not None:
            kind, uid, name, vuid = item[u"k"], item[u"u"], item[u"t"], u""
            kind = u"elem" if kind not in (u"view", u"sheet", u"room") else kind
        elif what == u"view":
            v = ad.ActiveView
            kind = u"sheet" if isinstance(v, DB.ViewSheet) else u"view"
            uid, name, vuid = v.UniqueId, unicode(v.Name), u""
            if kind == u"sheet":
                try:
                    name = u"{} - {}".format(unicode(v.SheetNumber), unicode(v.Name))    # as in the Revit tab: number - name
                except Exception:
                    pass
        else:
            ids = list(ad.Selection.GetElementIds())
            if not ids:
                return self.hdr_toast(u"Select an element first")
            el = d.GetElement(ids[0])
            kind, uid, vuid = u"elem", el.UniqueId, ad.ActiveView.UniqueId
            try:
                name = unicode(el.Category.Name) + u" " + unicode(el.Name)
            except Exception:
                name = u"Element"
        url = tkw_link_build(tkw_model_key(d), unicode(d.Title), kind, uid, name, vuid, self.settings.get("link_web_base", TKW_WEB_DEFAULT) or u"")
        label = name or kind                      # readable link text: without the model name
        if tkw_clip_link(url, label):
            self.hdr_toast(u"Link copied: " + (name or kind))
        else:
            self.hdr_toast(u"The clipboard is busy, try again")

    def tkx_lk_front(self):
        try:
            import ctypes
            u32 = ctypes.windll.user32
            h = int(uiapp.MainWindowHandle.ToInt64())
            if u32.IsIconic(h):
                u32.ShowWindow(h, 9)
            elif int(u32.GetForegroundWindow() or 0) != h:
                u32.SetForegroundWindow(h)
        except Exception as ex:
            tk_log(u"links: foreground: {}".format(ex))

    def tkx_lk_tick(self, s, e):
        try:
            if self.closed:
                self._tkx_lk_timer.Stop()
                return
            if not os.path.isdir(TKW_LINK_DIR):
                return
            names = sorted([n for n in os.listdir(TKW_LINK_DIR) if n.endswith(".req")])[:5]
            if not names:
                return
            tk_log(u"links: found {} request file(s)".format(len(names)))
            for n in names:
                p = os.path.join(TKW_LINK_DIR, n)
                try:
                    age = time.time() - os.path.getmtime(p)
                    raw = File.ReadAllBytes(p)
                    tk_log(u"links: read {} bytes".format(len(raw)))
                    File.Delete(p)
                except Exception as ex:
                    tk_log(u"links: read failed: {}".format(ex))
                    try:
                        File.Delete(p)
                    except Exception:
                        pass
                    continue
                if age > TKW_LINK_MAX_AGE:
                    tk_log(u"links: request is too old, dropped")
                    continue
                text = bytes(bytearray(raw)).decode("utf-8", "replace")
                tk_log(u"links: text {}".format(text[:160]))
                req = tkw_link_parse(text)
                tk_log(u"links: parsed {}".format(u"ok" if req else u"REJECTED"))
                if req is None:
                    self.hdr_toast(u"Unrecognised Revit link")
                    continue
                self.tkx_later(lambda r=req: self.tkx_lk_dispatch(r), 350)
        except Exception as ex:
            tk_log(u"links tick: {}\n{}".format(ex, traceback.format_exc()))

    def tkx_lk_dispatch(self, req):
        tk_log(u"links: dispatch")
        self.tkx_lk_front()
        self.run(lambda ua, rr=req: self.tkx_lk_open(ua, rr), None)

    def tkx_lk_open(self, ua, r):
        tk_log(u"links: open start")
        ad = ua.ActiveUIDocument
        target = None
        try:
            for dd in ua.Application.Documents:
                if dd.IsFamilyDocument or dd.IsLinked:
                    continue
                if (r[u"m"] and tkw_model_key(dd) == r[u"m"]) or (not r[u"m"] and ad is not None and dd.Equals(ad.Document)):
                    target = dd
                    break
        except Exception as ex:
            tk_log(u"links find doc: {}".format(ex))
        if target is None:
            return self.hdr_toast(u"The link is for model \u00AB{}\u00BB, it is not open in this Revit".format(r[u"t"] or u"?"))
        if ad is None or not target.Equals(ad.Document):
            try:
                if target.PathName:
                    ua.OpenAndActivateDocument(target.PathName)
            except Exception as ex:
                tk_log(u"links activate: {}".format(ex))
            ad = ua.ActiveUIDocument
            if ad is None or not target.Equals(ad.Document):
                return self.hdr_toast(u"Switch to model \u00AB{}\u00BB and click the link again".format(target.Title))
        el = target.GetElement(r[u"u"])
        if el is None:
            return self.hdr_toast(u"Not found in the model (deleted?): {}".format(r[u"n"] or r[u"k"]))
        if r[u"k"] in (u"view", u"sheet"):
            if not self.tkx_go_view(ad, el):
                return self.hdr_toast(u"This view cannot be opened")
        elif r[u"k"] == u"room":
            self.tkx_go_room(ad, el)
        else:
            self.tkx_go_element(ad, el, target.GetElement(r[u"v"]) if r[u"v"] else None)
        tk_log(u"links: open done")
        self.hdr_toast(u"Opened: " + (r[u"n"] or r[u"k"]))

    def tkx_lk_toggle(self):
        on = not self.settings.get("link_register", True)
        self.settings["link_register"] = on
        save_settings(self.settings)
        try:
            if on:
                tkw_reg_install()
            else:
                tkw_reg_remove()
        except Exception as ex:
            tk_log(u"links toggle: {}".format(ex))
        self.hdr_toast(u"Revit links (utk://): " + (u"on" if on else u"off"))

    def tkx_lk_set_web(self):
        cur = self.settings.get("link_web_base", TKW_WEB_DEFAULT) or u""
        v = ask_string(self.tkx_wl_owner(), u"Revit links: web page",
                       u"https:// address of the redirect page (utk_open.html). Empty = copy plain utk:// links", cur)
        if v is None:
            return
        v = v.strip()
        if v and not v.lower().startswith(u"https://"):
            return self.hdr_toast(u"The address must start with https://")
        self.settings["link_web_base"] = v
        save_settings(self.settings)
        self.hdr_toast(u"Links will be copied as " + (u"web links" if v else u"utk:// links"))

    # ------------------------------------------------- Settings export / import
    def tkx_export_settings(self):
        try:
            dlg = SaveFileDialog()
            dlg.Title = u"Export Universal Toolkit settings"
            dlg.Filter = u"Toolkit settings (*.json)|*.json"
            dlg.DefaultExt = u".json"
            dlg.FileName = u"UniversalToolkit_settings_{}.json".format(time.strftime(u"%Y%m%d"))
            if not dlg.ShowDialog():
                return
            st = {}
            for k in TKX_PORTABLE:
                if k in self.settings:
                    st[k] = self.settings[k]
            bundle = {u"format": TKX_FORMAT, u"version": 1, u"toolkit": TKX_VERSION,
                      u"exported": time.strftime(u"%Y-%m-%d %H:%M:%S"), u"settings": st, u"annotations": self.ann_store}
            if _write_json(dlg.FileName, bundle):
                self.hdr_toast(u"Settings saved: " + os.path.basename(dlg.FileName))
            else:
                self.hdr_toast(u"Could not write the file (see toolkit_debug.log)")
        except Exception as ex:
            tk_log(u"export settings: {}\n{}".format(ex, traceback.format_exc()))
            self.note_error(u"Export settings", ex, traceback.format_exc())

    def tkx_import_settings(self):
        try:
            dlg = OpenFileDialog()
            dlg.Title = u"Import Universal Toolkit settings"
            dlg.Filter = u"Toolkit settings (*.json)|*.json|All files (*.*)|*.*"
            if not dlg.ShowDialog():
                return
            path = dlg.FileName
            if os.path.getsize(path) > 5 * 1024 * 1024:
                MessageBox.Show(self.win, u"The file is too large for a settings file (over 5 MB).", u"Import settings")
                return
            with open(path, "rb") as f:
                raw = f.read()
            if raw[:3] == b"\xef\xbb\xbf":
                raw = raw[3:]
            try:
                data = json.loads(raw.decode("utf-8"))
            except Exception as ex:
                MessageBox.Show(self.win, u"This is not valid JSON: {}".format(err_text(ex)), u"Import settings")
                return
            if not isinstance(data, dict) or data.get(u"format") != TKX_FORMAT:
                MessageBox.Show(self.win, u"The file does not look like a Universal Toolkit export (no format marker).", u"Import settings")
                return
            if not isinstance(data.get(u"version"), int) or data[u"version"] > 1:
                MessageBox.Show(self.win, u"The file was created by a newer Toolkit version (format {}). Update the script.".format(data.get(u"version")),
                                u"Import settings")
                return
            st, skipped = tkx_clean_settings(data.get(u"settings"))
            ann = data.get(u"annotations")
            ann = ann if isinstance(ann, dict) else {}
            msg = u"File: {}\nExport: {}\n\nWill be applied:\n  \u2022 settings: {}\n  \u2022 annotation sections: {}".format(
                os.path.basename(path), data.get(u"exported", u"?"), len(st), len(ann))
            if skipped:
                msg += u"\n  \u2022 skipped keys (unknown or of the wrong type): {}".format(len(skipped))
            msg += u"\n\nData from the file takes precedence over the current data; annotations are merged with the lists. Before the changes the current files will be saved in the backup folder.\n\nContinue?"
            if MessageBox.Show(self.win, msg, u"Import settings", MessageBoxButton.YesNo) != MessageBoxResult.Yes:
                return
            if not os.path.isdir(TKX_BACKUP_DIR):
                os.makedirs(TKX_BACKUP_DIR)
            stamp = time.strftime(u"%Y%m%d_%H%M%S")
            for src, nm in ((SET_PATH, u"settings"), (ANN_PATH, u"annotations")):
                if os.path.exists(src):
                    shutil.copyfile(src, os.path.join(TKX_BACKUP_DIR, u"{}_{}.json".format(nm, stamp)))
            for k, v in st.items():
                self.settings[k] = tkx_merge(self.settings.get(k), v) if isinstance(v, dict) else v
            merged = tkx_merge(self.ann_store, ann, union_lists=True)
            self.ann_store.clear()
            self.ann_store.update(merged)
            save_settings(self.settings)
            save_ann_store(self.ann_store)
            if u"browser_params" in st:
                BROWSER_PARAMS[:] = [x for x in st[u"browser_params"] if isinstance(x, basestring)]
                self.tbBrowserParams.Text = u", ".join(BROWSER_PARAMS)
            try:
                self.ann_reload()
            except Exception as ex:
                tk_log(u"import: ann_reload: {}".format(ex))
            self.hdr_toast(u"Settings imported. Strip positions and modes will be picked up after Toolkit is restarted")
        except Exception as ex:
            tk_log(u"import settings: {}\n{}".format(ex, traceback.format_exc()))
            self.note_error(u"Import settings", ex, traceback.format_exc())


for _n in list(TkxMixin.__dict__.keys()):
    if _n.startswith(u"tkx_") or _n == u"note_error":
        setattr(PrintSetWindow, _n, TkxMixin.__dict__[_n])



w = PrintSetWindow()
tk_log(u'before Show()')
if not getattr(w, "_mini", False):
    w.win.Show()   # modeless
else:
    # icon mode: the window is loaded invisibly (Loaded: indexing, etc. work as always), then hidden; the panel opens on a click on the icon
    try:
        w.win.Opacity = 0.0
        w.win.ShowActivated = False

        def _tk_hide_after_load(s_, e_):
            try:
                if getattr(w, "_mini", False) and not getattr(w, "_mini_prog", False):
                    w.win.Hide()
            except Exception as ex_:
                tk_log(u"hide after load: {}".format(ex_))
            w.win.Opacity = 1.0
            w.win.ShowActivated = True
        w.win.Loaded += _tk_hide_after_load
        w.win.Show()
    except Exception as ex_:
        tk_log(u"mini startup show: {}".format(ex_))
tk_log(u'after Show()')
