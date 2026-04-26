export type NodeDomainErrorCode =
  | 'DUPLICATE_NODE_ID'
  | 'INVALID_CHILD_TYPE'
  | 'INVALID_INSERT_INDEX'
  | 'INVALID_REFERENCE'
  | 'INVALID_TAG'
  | 'MOVE_TARGET_IS_DESCENDANT'
  | 'MISSING_PREVIOUS_SIBLING'
  | 'NODE_NOT_FOUND'
  | 'ROOT_OPERATION_NOT_ALLOWED';

export class NodeDomainError extends Error {
  readonly code: NodeDomainErrorCode;
  readonly details?: Record<string, string | number | boolean | null>;

  constructor(
    code: NodeDomainErrorCode,
    message: string,
    details?: Record<string, string | number | boolean | null>,
  ) {
    super(message);
    this.name = 'NodeDomainError';
    this.code = code;
    this.details = details;
  }
}
