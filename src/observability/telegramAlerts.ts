/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { globalLogger } from './logger';

export interface ITelegramAlertPayload {
  level: 'INFO' | 'WARN' | 'CRITICAL';
  title: string;
  details: string;
  metadata?: Record<string, any>;
}

export class TelegramAlertNotifier {
  private botToken: string | null = null;
  private chatId: string | null = null;
  private enabled: boolean = false;
  private alertQueue: ITelegramAlertPayload[] = [];
  private lastAlertTime: number = 0;
  private minIntervalMs: number = 2000; // Rate limit 1 alert per 2 seconds

  constructor() {
    this.initFromEnv();
  }

  public initFromEnv() {
    const token = (typeof process !== 'undefined' && process.env?.TELEGRAM_BOT_TOKEN) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TELEGRAM_BOT_TOKEN);
    const chat = (typeof process !== 'undefined' && process.env?.TELEGRAM_CHAT_ID) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TELEGRAM_CHAT_ID);

    if (token && chat) {
      this.botToken = token;
      this.chatId = chat;
      this.enabled = true;
      globalLogger.info('Telegram Alert Service initialized with configured bot credentials.');
    } else {
      this.enabled = false;
    }
  }

  public isConfigured(): boolean {
    return this.enabled && !!this.botToken && !!this.chatId;
  }

  public configure(botToken: string, chatId: string) {
    this.botToken = botToken;
    this.chatId = chatId;
    this.enabled = true;
    globalLogger.info('Telegram Alert Service dynamically configured.');
  }

  public async sendAlert(alert: ITelegramAlertPayload): Promise<boolean> {
    const icon = alert.level === 'CRITICAL' ? '🚨' : alert.level === 'WARN' ? '⚠️' : 'ℹ️';
    const message = `${icon} *[POLYMASTER QUANTUM]* ${alert.title}\n\n${alert.details}${
      alert.metadata ? `\n\n\`${JSON.stringify(alert.metadata, null, 2)}\`` : ''
    }\n_Time: ${new Date().toISOString()}_`;

    globalLogger.log(
      alert.level === 'CRITICAL' ? 'ERROR' : alert.level === 'WARN' ? 'WARN' : 'INFO',
      `[TELEGRAM] ${alert.title}: ${alert.details}`
    );

    if (!this.isConfigured()) {
      return false;
    }

    const now = Date.now();
    if (now - this.lastAlertTime < this.minIntervalMs) {
      // Throttle notification storms
      return false;
    }
    this.lastAlertTime = now;

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'Markdown'
        })
      });

      return res.ok;
    } catch (err: any) {
      globalLogger.warn(`Failed to dispatch Telegram alert: ${err.message}`);
      return false;
    }
  }
}

export const globalTelegramNotifier = new TelegramAlertNotifier();
