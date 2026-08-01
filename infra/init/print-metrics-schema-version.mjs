#!/usr/bin/env node
/**
 * Print METRICS_SCHEMA_VERSION to stdout.
 *
 * KV のキャッシュキー (screener:metrics:<version>) を CI から無効化する際に使う。
 * ワークフロー側にリテラルを書くと定数を上げたときに乖離し、実際に読まれている
 * キーが二度と無効化されなくなるため、パッケージから直接読む。
 */
import { METRICS_SCHEMA_VERSION } from "../../packages/metrics/src/index.ts";

process.stdout.write(METRICS_SCHEMA_VERSION);
