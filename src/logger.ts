import {Analytics} from './analytics';

export interface Logger {
  log(...args): void;
  logError(...args): void;
}

export class SimpleLogger implements Logger {
  log(...args){
    console.log(`[${new Date().toISOString()}]`, ...args);
  }
  logError(...args) {
    console.error(`[${new Date().toISOString()}]`, ...args);
  }
}

export class AnalyticsLogger extends SimpleLogger {
  private analytics: Analytics;
  constructor(analytics: Analytics) {
    super();
    this.analytics = analytics;
  }
  logError(...args){
    super.logError(...args);
    this.analytics.logError(...args);
  }
}