declare module '@modelcontextprotocol/sdk' {
  export interface Tool {
    name: string;
    description: string;
    inputSchema: any;
  }

  export interface ListToolsResponse {
    tools: Tool[];
  }

  export class ClientSession {
    constructor(
      stdio: any,
      write: any
    );
    
    initialize(): Promise<void>;
    list_tools(): Promise<ListToolsResponse>;
    call_tool(name: string, params: any): Promise<any>;
  }

  export function StdioServerParameters(params: {
    command: string;
    args: string[];
    env?: Record<string, string>;
  }): any;
}

declare module '@modelcontextprotocol/sdk/dist/client/stdio.js' {
  export function stdio_client(serverParams: any): Promise<[any, any]>;
} 