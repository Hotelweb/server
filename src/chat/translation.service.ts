import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TranslationResult {
  text: string;
  status: 'success' | 'fallback' | 'error';
  provider: 'openai' | 'deepl' | 'google' | 'mock';
  detectedLanguage?: string;
  durationMs: number;
}

/**
 * Translation service designed for hospitality / hotel booking conversations.
 *
 * Provider strategy (first that has credentials wins):
 *   1. OpenAI (preferred — best context awareness for hospitality)
 *   2. DeepL  (fast, high quality for major languages)
 *   3. Google Translate (broad language coverage)
 *   4. Mock   (always available — annotates message with [VI] / [EN] etc.
 *              so the UI flow can be tested end-to-end without API keys)
 *
 * Read the steering: keep response time as low as possible. We use short
 * timeouts and fall back gracefully so the chat is never blocked by translation.
 */
@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly provider: 'openai' | 'deepl' | 'google' | 'mock';
  private readonly timeoutMs = 5000;

  constructor(private readonly configService: ConfigService) {
    if (this.configService.get<string>('OPENAI_API_KEY')) {
      this.provider = 'openai';
    } else if (this.configService.get<string>('DEEPL_API_KEY')) {
      this.provider = 'deepl';
    } else if (this.configService.get<string>('GOOGLE_TRANSLATE_API_KEY')) {
      this.provider = 'google';
    } else {
      this.provider = 'mock';
    }
    this.logger.log(`Translation provider initialized: ${this.provider}`);
  }

  getProvider(): string {
    return this.provider;
  }

  /**
   * Translate a text from `sourceLang` -> `targetLang`.
   * Returns the original text in the result if source equals target.
   */
  async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
  ): Promise<TranslationResult> {
    const start = Date.now();
    const trimmed = (text || '').trim();

    // No-op: same language or empty
    if (!trimmed || sourceLang === targetLang) {
      return {
        text: trimmed,
        status: 'success',
        provider: this.provider,
        durationMs: 0,
      };
    }

    try {
      let translated: string;
      switch (this.provider) {
        case 'openai':
          translated = await this.translateWithOpenAI(
            trimmed,
            sourceLang,
            targetLang,
          );
          break;
        case 'deepl':
          translated = await this.translateWithDeepL(
            trimmed,
            sourceLang,
            targetLang,
          );
          break;
        case 'google':
          translated = await this.translateWithGoogle(
            trimmed,
            sourceLang,
            targetLang,
          );
          break;
        default:
          translated = this.mockTranslate(trimmed, sourceLang, targetLang);
      }

      return {
        text: translated,
        status: 'success',
        provider: this.provider,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      this.logger.warn(
        `Translation failed (${sourceLang}->${targetLang}): ${(err as Error).message}`,
      );
      // Graceful fallback: return original wrapped so UI can flag it
      return {
        text: trimmed,
        status: 'error',
        provider: this.provider,
        durationMs: Date.now() - start,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Providers
  // ---------------------------------------------------------------------------

  /**
   * OpenAI chat-completion based translation with hospitality context.
   * Best quality for nuanced booking conversations (room types, dates, prices).
   */
  private async translateWithOpenAI(
    text: string,
    source: string,
    target: string,
  ): Promise<string> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const model =
      this.configService.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';

    const systemPrompt = `You are a professional hotel concierge translator. Translate the user's message accurately and naturally for a hospitality / hotel-booking context. Keep proper nouns, room numbers, dates, and prices unchanged. Output the translation only, with no quotes, prefixes, or commentary.`;

    const userPrompt = `Translate from ${this.languageLabel(source)} to ${this.languageLabel(target)}:\n\n${text}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`OpenAI returned ${res.status}`);
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const out = json.choices?.[0]?.message?.content?.trim();
      if (!out) throw new Error('OpenAI returned empty translation');
      return out;
    } finally {
      clearTimeout(timer);
    }
  }

  private async translateWithDeepL(
    text: string,
    source: string,
    target: string,
  ): Promise<string> {
    const apiKey = this.configService.get<string>('DEEPL_API_KEY');
    const isFree = (apiKey ?? '').endsWith(':fx');
    const url = isFree
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          text,
          source_lang: source.toUpperCase(),
          target_lang: target.toUpperCase(),
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`DeepL returned ${res.status}`);
      const json = (await res.json()) as {
        translations?: Array<{ text?: string }>;
      };
      const out = json.translations?.[0]?.text;
      if (!out) throw new Error('DeepL returned empty translation');
      return out;
    } finally {
      clearTimeout(timer);
    }
  }

  private async translateWithGoogle(
    text: string,
    source: string,
    target: string,
  ): Promise<string> {
    const apiKey = this.configService.get<string>('GOOGLE_TRANSLATE_API_KEY');
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source,
          target,
          format: 'text',
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`Google returned ${res.status}`);
      const json = (await res.json()) as {
        data?: { translations?: Array<{ translatedText?: string }> };
      };
      const out = json.data?.translations?.[0]?.translatedText;
      if (!out) throw new Error('Google returned empty translation');
      return out;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Mock translator for local development / when no API keys are configured.
   *
   * It uses a small phrasebook for the most common hospitality phrases so the
   * UI demo feels real, then tags the message with the target language.
   */
  private mockTranslate(text: string, _source: string, target: string): string {
    const lower = text.toLowerCase().trim();
    const phrasebook = MOCK_PHRASEBOOK[target] || {};

    // Try exact phrase match first
    if (phrasebook[lower]) {
      return phrasebook[lower];
    }

    // Try fuzzy phrase match (any phrase contained in the text)
    for (const [src, tgt] of Object.entries(phrasebook)) {
      if (lower.includes(src)) {
        return text.replace(new RegExp(src, 'i'), tgt);
      }
    }

    // Fallback: tag with target language so devs can SEE which side rendered
    const flag = LANGUAGE_FLAG[target] || '🌐';
    return `${flag} [${target.toUpperCase()}] ${text}`;
  }

  private languageLabel(code: string): string {
    return LANGUAGE_LABEL[code] ?? code;
  }
}

const LANGUAGE_LABEL: Record<string, string> = {
  vi: 'Vietnamese',
  en: 'English',
  ja: 'Japanese',
  zh: 'Chinese',
  ko: 'Korean',
  th: 'Thai',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  ru: 'Russian',
};

const LANGUAGE_FLAG: Record<string, string> = {
  vi: '🇻🇳',
  en: '🇬🇧',
  ja: '🇯🇵',
  zh: '🇨🇳',
  ko: '🇰🇷',
  th: '🇹🇭',
};

/**
 * Tiny phrasebook for the mock translator — enough to make the UI demo feel
 * realistic when no API keys are configured. Keep keys lower-cased.
 */
const MOCK_PHRASEBOOK: Record<string, Record<string, string>> = {
  vi: {
    'i want to book': 'Tôi muốn đặt phòng',
    'i want to book a room': 'Tôi muốn đặt phòng',
    'do you have available rooms': 'Quý khách sạn còn phòng trống không?',
    'do you have available rooms?': 'Quý khách sạn còn phòng trống không?',
    'late check-in': 'Nhận phòng muộn',
    'airport pickup': 'Đưa đón sân bay',
    'i need help': 'Tôi cần giúp đỡ',
    hello: 'Xin chào',
    'hi there': 'Xin chào',
    thanks: 'Cảm ơn',
    'thank you': 'Cảm ơn',
    yes: 'Vâng',
    no: 'Không',
    'how much': 'Giá bao nhiêu',
    breakfast: 'Bữa sáng',
    'check-in time': 'Giờ nhận phòng',
    'check-out time': 'Giờ trả phòng',
    こんにちは: 'Xin chào',
    予約したい: 'Tôi muốn đặt phòng',
    空室はありますか: 'Còn phòng trống không?',
    你好: 'Xin chào',
    我想订房: 'Tôi muốn đặt phòng',
    안녕하세요: 'Xin chào',
    '예약하고 싶어요': 'Tôi muốn đặt phòng',
  },
  en: {
    'xin chào': 'Hello',
    'cảm ơn': 'Thank you',
    vâng: 'Yes',
    không: 'No',
    'tôi muốn đặt phòng': 'I would like to book a room',
    'còn phòng trống không': 'Are any rooms available?',
    'còn phòng trống không?': 'Are any rooms available?',
    'giờ nhận phòng là mấy giờ': 'What time is check-in?',
    'giờ trả phòng là mấy giờ': 'What time is check-out?',
    'có ăn sáng không': 'Is breakfast included?',
    'đưa đón sân bay': 'Airport transfer',
    'phòng đôi': 'Double room',
    'phòng đơn': 'Single room',
    'phòng gia đình': 'Family room',
    'bao nhiêu tiền một đêm': 'How much per night?',
    'một đêm': 'One night',
    'hai đêm': 'Two nights',
    'rất cảm ơn quý khách': 'Thank you very much',
    'chúng tôi vẫn còn phòng trống':
      'Yes, we still have rooms available for those dates.',
    'vâng, chúng tôi vẫn còn phòng trống':
      'Yes, we still have rooms available.',
    'quý khách muốn đặt từ ngày nào': 'What dates would you like to book?',
  },
  ja: {
    'tôi muốn đặt phòng': '予約したいです',
    'cảm ơn': 'ありがとうございます',
    'xin chào': 'こんにちは',
  },
  zh: {
    'tôi muốn đặt phòng': '我想订房',
    'cảm ơn': '谢谢',
    'xin chào': '你好',
  },
  ko: {
    'tôi muốn đặt phòng': '예약하고 싶어요',
    'cảm ơn': '감사합니다',
    'xin chào': '안녕하세요',
  },
  th: {
    'tôi muốn đặt phòng': 'ฉันต้องการจองห้อง',
    'cảm ơn': 'ขอบคุณ',
    'xin chào': 'สวัสดี',
  },
};
