import '../styles/variables.css';
import '../styles/base.css';
import '../styles/reader.css';
import '../styles/home.css';
import '../styles/graph.css';
import '../styles/boards.css';
import '../styles/polish.css';
import '../styles/editor.css';

export const metadata = {
  title: 'Knowledge Library',
  description: 'Internal BIM Knowledge Library with Notion-style editor, dependency graph, and visual link boards.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
