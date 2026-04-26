import AppLayout from '../ui/AppLayout';
import AppShellPlaceholder from '../ui/AppShellPlaceholder';

export default function HomePage() {
  return (
    <AppLayout
      leftPanel={
        <AppShellPlaceholder
          description="后续接入节点树、重排、定位相关能力。"
          title="结构视图占位"
        />
      }
      mainPanel={
        <AppShellPlaceholder
          description="后续接入主题输入、学习内容编辑、问答与总结区域。"
          title="文本主视图占位"
        />
      }
      rightPanel={
        <AppShellPlaceholder
          description="后续接入资料源、引用、切片与搜索辅助能力。"
          title="资料区占位"
        />
      }
    />
  );
}
