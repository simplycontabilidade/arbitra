import Anthropic from 'npm:@anthropic-ai/sdk@0.27.0';

export const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
});

export const MODELS = {
  FAST: 'claude-haiku-4-5',
  SMART: 'claude-sonnet-4-6',
} as const;
