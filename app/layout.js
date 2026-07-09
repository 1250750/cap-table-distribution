import "./globals.css";

export const metadata = {
  title: "Cap Table Distribution",
  description: "Editable cap table distribution visualizer with vesting and pool views.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
