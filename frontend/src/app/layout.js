import { Urbanist } from 'next/font/google';
import Providers from '@/components/Providers';
import './globals.css';

const urbanist = Urbanist({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata = {
  title: {
    default: 'Stockify-POS',
    template: '%s | Stockify-POS',
  },
  description: 'Inventory & Point of Sale management system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={urbanist.variable}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}