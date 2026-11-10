import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

// 定位引擎根目录：发布后用包内 engine/，开发时退回仓库根目录
function resolveRoot() {
  const packed = new URL('../engine/', import.meta.url);
  if (existsSync(fileURLToPath(new URL('scripts/bazi_cli.cjs', packed)))) {
    return fileURLToPath(packed);
  }
  return fileURLToPath(new URL('../../../', import.meta.url));
}

export function loadEngine() {
  const root = resolveRoot();
  const load = (name) => require(`${root}scripts/${name}`).run;
  return {
    bazi: load('bazi_cli.cjs'),
    ziwei: load('ziwei_skill_cli.cjs'),
    qimen: load('qimen_cli.cjs'),
    calendar: load('calendar_cli.cjs'),
    astro: load('astro_cli.cjs'),
    cliEnvelope: require(`${root}lib/cliEnvelope.cjs`),
    schemaPath: `${root}schemas/xuanxue-output.schema.json`,
  };
}
