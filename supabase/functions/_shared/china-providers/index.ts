import type { ChinaSourceProvider } from '../types.ts';
import { MockChinaProvider } from './mock-provider.ts';
import { RapidApi1688Provider } from './rapidapi-1688.ts';

export async function getChinaProvider(): Promise<ChinaSourceProvider> {
  const providerName = Deno.env.get('CHINA_PROVIDER') ?? 'mock';

  switch (providerName) {
    case 'rapidapi_1688':
      return new RapidApi1688Provider();
    case 'mock':
      return new MockChinaProvider();
    default:
      console.warn(`Unknown provider: ${providerName}, falling back to mock`);
      return new MockChinaProvider();
  }
}

export type { ChinaSourceProvider, ChinaSearchQuery } from '../types.ts';
