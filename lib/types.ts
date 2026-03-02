export interface Column {
  name: string;
  type: string;
  pk?: boolean;
  fk?: string; // 참조 테이블명
  unique?: boolean;
  notNull?: boolean;
  default?: string;
  comment?: string;
}

export interface Table {
  name: string;
  comment?: string;
  columns: Column[];
}

export interface SchemaJSON {
  tables: Table[];
}

export interface AIResponse {
  message: string;
  schema: SchemaJSON;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string; // assistant는 message 텍스트만 저장 (schema 제외)
}
