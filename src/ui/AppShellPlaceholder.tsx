import SectionCard from './SectionCard';

type AppShellPlaceholderProps = {
  title: string;
  description: string;
};

export default function AppShellPlaceholder({
  title,
  description,
}: AppShellPlaceholderProps) {
  return (
    <SectionCard>
      <p className="section-label">待后续工作树接入</p>
      <h2 className="section-title">{title}</h2>
      <p className="section-description">{description}</p>
    </SectionCard>
  );
}
