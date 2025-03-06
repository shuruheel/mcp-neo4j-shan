declare module '@modelcontextprotocol/sdk/types.js' {
  export interface Tool {
    name: string;
    description: string;
    inputSchema: any;
  }

  export interface ListToolsResponse {
    tools: Tool[];
  }
}

declare module '@modelcontextprotocol/sdk/client/index.js' {
  export class Client {
    constructor(clientInfo?: any);
    
    connect(transport: any): Promise<void>;
    callTool(params: any, resultSchema?: any, onprogress?: any): Promise<any>;
    listTools(params?: any, onprogress?: any): Promise<any>;
  }
}

declare module '@modelcontextprotocol/sdk/client/stdio.js' {
  export type StdioServerParameters = {
    command: string;
    args: string[];
    env?: Record<string, string>;
  };

  export function getDefaultEnvironment(): Record<string, string>;
  
  export class StdioClientTransport {
    constructor(server: StdioServerParameters);
    start(): Promise<void>;
    send(message: any): Promise<void>;
    close(): Promise<void>;
    
    onmessage?: (message: any) => void;
    onerror?: (error: Error) => void;
    onclose?: () => void;
  }
} 