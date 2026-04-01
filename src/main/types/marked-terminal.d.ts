declare module "marked-terminal" {
  import { MarkedExtension } from "marked";
  
  interface MarkedTerminalOptions {
    code?: (...args: any[]) => string;
    codespan?: (...args: any[]) => string;
    strong?: (...args: any[]) => string;
    em?: (...args: any[]) => string;
    heading?: (...args: any[]) => string;
    hr?: string;
    listitem?: (...args: any[]) => string;
    table?: (...args: any[]) => string;
    link?: (...args: any[]) => string;
    [key: string]: any;
  }

  export function markedTerminal(options?: MarkedTerminalOptions): MarkedExtension;
}
