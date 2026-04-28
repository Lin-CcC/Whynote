export type JsonObjectParseErrorCode =
  | 'json_object_not_found'
  | 'json_object_incomplete'
  | 'json_object_invalid'
  | 'json_root_not_object';

export class JsonObjectParseError extends Error {
  readonly code: JsonObjectParseErrorCode;

  constructor(code: JsonObjectParseErrorCode, message: string) {
    super(message);
    this.name = 'JsonObjectParseError';
    this.code = code;
  }
}

export function parseJsonObjectWithTolerance(rawText: string) {
  const normalizedText = rawText.trim();

  if (!normalizedText) {
    throw new JsonObjectParseError(
      'json_object_not_found',
      'AI 返回的内容里没有可解析的 JSON 对象。',
    );
  }

  const directParseResult = tryParseJsonObject(normalizedText);

  if (directParseResult.kind === 'success') {
    return directParseResult.value;
  }

  if (directParseResult.kind === 'non_object') {
    throw new JsonObjectParseError(
      'json_root_not_object',
      'AI 返回的 JSON 能解析，但根节点不是对象，和当前任务约定不符。',
    );
  }

  const extractedObject = extractFirstJsonObject(normalizedText);

  if (extractedObject.kind === 'success') {
    return extractedObject.value;
  }

  if (extractedObject.kind === 'invalid') {
    throw new JsonObjectParseError(
      'json_object_invalid',
      'AI 返回的内容包含疑似 JSON 对象，但对象本身不是合法 JSON。',
    );
  }

  if (extractedObject.kind === 'incomplete') {
    throw new JsonObjectParseError(
      'json_object_incomplete',
      'AI 返回的内容看起来像 JSON，但对象不完整或已被截断。',
    );
  }

  throw new JsonObjectParseError(
    'json_object_not_found',
    'AI 返回的内容里没有可解析的 JSON 对象。',
  );
}

function extractFirstJsonObject(text: string) {
  let sawObjectStart = false;
  let sawInvalidObject = false;

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '{') {
      continue;
    }

    sawObjectStart = true;

    const objectEndIndex = findJsonObjectEnd(text, index);

    if (objectEndIndex === null) {
      continue;
    }

    const candidate = text.slice(index, objectEndIndex + 1);
    const parseResult = tryParseJsonObject(candidate);

    if (parseResult.kind === 'success') {
      return parseResult;
    }

    sawInvalidObject = true;
  }

  if (sawInvalidObject) {
    return {
      kind: 'invalid' as const,
    };
  }

  if (sawObjectStart) {
    return {
      kind: 'incomplete' as const,
    };
  }

  return {
    kind: 'not_found' as const,
  };
}

function findJsonObjectEnd(text: string, startIndex: number) {
  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const currentCharacter = text[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (currentCharacter === '\\') {
        isEscaped = true;
        continue;
      }

      if (currentCharacter === '"') {
        inString = false;
      }

      continue;
    }

    if (currentCharacter === '"') {
      inString = true;
      continue;
    }

    if (currentCharacter === '{') {
      depth += 1;
      continue;
    }

    if (currentCharacter !== '}') {
      continue;
    }

    depth -= 1;

    if (depth === 0) {
      return index;
    }
  }

  return null;
}

function tryParseJsonObject(text: string) {
  try {
    const parsedValue = JSON.parse(text) as unknown;

    if (!isRecord(parsedValue)) {
      return {
        kind: 'non_object' as const,
      };
    }

    return {
      kind: 'success' as const,
      value: parsedValue,
    };
  } catch {
    return {
      kind: 'invalid' as const,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
