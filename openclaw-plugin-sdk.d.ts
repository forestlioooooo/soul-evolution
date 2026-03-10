declare module "openclaw/plugin-sdk/core" {
  export interface OpenClawPluginApi {
    pluginConfig: Record<string, unknown> | undefined;
    logger: {
      info(msg: string): void;
      warn(msg: string): void;
    };
    on(event: string, handler: (...args: any[]) => any): void;
  }
}
