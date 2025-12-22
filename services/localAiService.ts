
export class LocalAiService {
  private static engine: any = null;
  private static initProgressCallback: ((progress: any) => void) | null = null;
  
  // TinyLlama is small (~600MB) and good for basic offline tasks
  static DEFAULT_LOCAL_MODEL = "TinyLlama-1.1B-Chat-v1.0-q4f32_1-MLC";
  // Llama 3 is better but larger (~4GB)
  static BETTER_LOCAL_MODEL = "Llama-3-8B-Instruct-q4f32_1-MLC";

  static isSupported(): boolean {
    return !!(navigator as any).gpu;
  }

  static async init(
    modelId: string = this.DEFAULT_LOCAL_MODEL, 
    onProgress?: (text: string) => void
  ) {
    if (this.engine) return;

    try {
      if (onProgress) onProgress("Initializing WebGPU...");
      
      // Dynamic import to bypass build-time resolution of URL imports by tsc
      // @ts-ignore
      const WebLLM = await import("https://esm.sh/@mlc-ai/web-llm@0.2.61");
      
      this.engine = await WebLLM.CreateMLCEngine(
        modelId,
        {
          initProgressCallback: (report: any) => {
            if (onProgress) onProgress(report.text);
          }
        }
      );
      console.log("Local AI Engine Loaded");
    } catch (e) {
      console.error("Failed to load Local AI", e);
      throw e;
    }
  }

  static async generate(
    messages: { role: string, content: string }[],
    tools?: any[]
  ): Promise<string> {
    if (!this.engine) throw new Error("Local Engine not initialized");

    try {
      // Note: WebLLM tool calling support is experimental/limited compared to Cloud APIs
      // We strip tools for now in offline mode to ensure stability unless using a model that strictly supports it
      const reply = await this.engine.chat.completions.create({
        messages,
        temperature: 0.7,
        stream: false, // Streaming could be added for better UX
      });

      return reply.choices[0].message.content;
    } catch (e) {
      console.error("Local Generation Failed", e);
      return "Error generating local response. (Offline)";
    }
  }

  static async unload() {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
    }
  }
}
