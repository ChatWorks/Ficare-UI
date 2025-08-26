import "./globals.css";

export const metadata = {
  title: "Ficare Financial Controller",
  description: "Financial Controller Agent",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.ico', type: 'image/x-icon' },
    ],
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="nl">
      <body>
          {children}
      </body>
    </html>
  );
}
