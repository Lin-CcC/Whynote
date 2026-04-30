import type {
  JudgmentNodeKind,
  CitationPurpose,
  NonRootNode,
  NodeReference,
  PlanStepStatus,
  SummaryNodeKind,
  Tag,
  ThemeRootNode,
  WorkspaceSnapshot,
} from './nodeTypes';

type CreateNodeInput =
  | {
      type: 'module';
      id?: string;
      title: string;
      content?: string;
      createdAt?: string;
      updatedAt?: string;
    }
  | {
      type: 'plan-step';
      id?: string;
      title: string;
      content?: string;
      status?: PlanStepStatus;
      createdAt?: string;
      updatedAt?: string;
    }
  | {
      type: 'answer';
      id?: string;
      title: string;
      content?: string;
      createdAt?: string;
      updatedAt?: string;
    }
  | {
      type: 'question';
      id?: string;
      title: string;
      content?: string;
      currentAnswerId?: string;
      createdAt?: string;
      updatedAt?: string;
    }
  | {
      type: 'summary';
      id?: string;
      title: string;
      content?: string;
      summaryKind?: SummaryNodeKind;
      sourceAnswerId?: string;
      sourceAnswerUpdatedAt?: string;
      createdAt?: string;
      updatedAt?: string;
    }
  | {
      type: 'judgment';
      id?: string;
      title: string;
      content?: string;
      hint?: string;
      judgmentKind?: JudgmentNodeKind;
      sourceAnswerId?: string;
      sourceAnswerUpdatedAt?: string;
      sourceSummaryId?: string;
      sourceSummaryUpdatedAt?: string;
      createdAt?: string;
      updatedAt?: string;
    }
  | {
      type: 'resource';
      id?: string;
      title: string;
      content?: string;
      sourceUri?: string;
      mimeType?: string;
      createdAt?: string;
      updatedAt?: string;
    }
  | {
      type: 'resource-fragment';
      id?: string;
      title: string;
      content?: string;
      sourceResourceId: string;
      locator?: string;
      excerpt: string;
      createdAt?: string;
      updatedAt?: string;
    };

interface BaseFactoryInput {
  id?: string;
  title: string;
  content?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function createThemeRootNode(
  title: string,
  options?: {
    id?: string;
    content?: string;
    createdAt?: string;
    updatedAt?: string;
  },
): ThemeRootNode {
  const timestamp = options?.createdAt ?? createTimestamp();

  return {
    id: options?.id ?? createId(),
    type: 'theme-root',
    title,
    content: options?.content ?? '',
    parentId: null,
    childIds: [],
    order: 0,
    tagIds: [],
    referenceIds: [],
    createdAt: timestamp,
    updatedAt: options?.updatedAt ?? timestamp,
  };
}

export function createNode(input: CreateNodeInput): NonRootNode {
  const baseNode = createBaseNode(input);

  switch (input.type) {
    case 'module':
      return {
        ...baseNode,
        type: 'module',
      };
    case 'plan-step':
      return {
        ...baseNode,
        type: 'plan-step',
        status: input.status ?? 'todo',
      };
    case 'answer':
      return {
        ...baseNode,
        type: 'answer',
      };
    case 'question':
      return {
        ...baseNode,
        type: 'question',
        ...(input.currentAnswerId
          ? { currentAnswerId: input.currentAnswerId }
          : {}),
      };
    case 'summary':
      return {
        ...baseNode,
        type: 'summary',
        ...(input.summaryKind ? { summaryKind: input.summaryKind } : {}),
        ...(input.sourceAnswerId
          ? { sourceAnswerId: input.sourceAnswerId }
          : {}),
        ...(input.sourceAnswerUpdatedAt
          ? { sourceAnswerUpdatedAt: input.sourceAnswerUpdatedAt }
          : {}),
      };
    case 'judgment':
      return {
        ...baseNode,
        type: 'judgment',
        hint: input.hint,
        ...(input.judgmentKind ? { judgmentKind: input.judgmentKind } : {}),
        ...(input.sourceAnswerId
          ? { sourceAnswerId: input.sourceAnswerId }
          : {}),
        ...(input.sourceAnswerUpdatedAt
          ? { sourceAnswerUpdatedAt: input.sourceAnswerUpdatedAt }
          : {}),
        ...(input.sourceSummaryId
          ? { sourceSummaryId: input.sourceSummaryId }
          : {}),
        ...(input.sourceSummaryUpdatedAt
          ? { sourceSummaryUpdatedAt: input.sourceSummaryUpdatedAt }
          : {}),
      };
    case 'resource':
      return {
        ...baseNode,
        type: 'resource',
        sourceUri: input.sourceUri,
        mimeType: input.mimeType,
      };
    case 'resource-fragment':
      return {
        ...baseNode,
        type: 'resource-fragment',
        sourceResourceId: input.sourceResourceId,
        locator: input.locator,
        excerpt: input.excerpt,
      };
  }
}

export function createTag(
  name: string,
  options?: {
    id?: string;
    color?: string;
    createdAt?: string;
    updatedAt?: string;
  },
): Tag {
  const timestamp = options?.createdAt ?? createTimestamp();

  return {
    id: options?.id ?? createId(),
    name,
    color: options?.color,
    createdAt: timestamp,
    updatedAt: options?.updatedAt ?? timestamp,
  };
}

export function createNodeReference(options: {
  sourceNodeId: string;
  targetNodeId: string;
  focusText?: string;
  id?: string;
  note?: string;
  purpose?: CitationPurpose;
  sourceExcerpt?: string;
  sourceLocator?: string;
  createdAt?: string;
  updatedAt?: string;
}): NodeReference {
  const timestamp = options.createdAt ?? createTimestamp();

  return {
    id: options.id ?? createId(),
    sourceNodeId: options.sourceNodeId,
    targetNodeId: options.targetNodeId,
    focusText: options.focusText,
    note: options.note,
    purpose: options.purpose,
    sourceExcerpt: options.sourceExcerpt,
    sourceLocator: options.sourceLocator,
    createdAt: timestamp,
    updatedAt: options.updatedAt ?? timestamp,
  };
}

export function createWorkspaceSnapshot(options: {
  title: string;
  workspaceId?: string;
  rootId?: string;
  createdAt?: string;
  updatedAt?: string;
}): WorkspaceSnapshot {
  const timestamp = options.createdAt ?? createTimestamp();
  const rootNode = createThemeRootNode(options.title, {
    id: options.rootId,
    createdAt: timestamp,
    updatedAt: options.updatedAt ?? timestamp,
  });

  return {
    workspace: {
      id: options.workspaceId ?? createId(),
      title: options.title,
      rootNodeId: rootNode.id,
      createdAt: timestamp,
      updatedAt: options.updatedAt ?? timestamp,
    },
    tree: {
      rootId: rootNode.id,
      nodes: {
        [rootNode.id]: rootNode,
      },
      tags: {},
      references: {},
    },
  };
}

function createBaseNode(input: BaseFactoryInput) {
  const timestamp = input.createdAt ?? createTimestamp();

  return {
    id: input.id ?? createId(),
    title: input.title,
    content: input.content ?? '',
    parentId: null,
    childIds: [],
    order: 0,
    tagIds: [],
    referenceIds: [],
    createdAt: timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  };
}

function createId() {
  return crypto.randomUUID();
}

function createTimestamp() {
  return new Date().toISOString();
}
