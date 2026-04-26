import type { ReactNode } from 'react';

type SectionCardProps = {
  children: ReactNode;
};

export default function SectionCard({ children }: SectionCardProps) {
  return <section className="section-card">{children}</section>;
}
