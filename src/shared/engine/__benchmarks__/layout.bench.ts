/**
 * 排版引擎性能基准测试
 *
 * 运行方式: npx vitest bench
 */
import { bench, describe } from 'vitest';
import { runLayout } from '../LayoutScheduler';
import { createPrintItem, createLayoutConfig } from '../../../__tests__/factories';

function makeItems(count: number) {
  return Array.from({ length: count }, (_, i) =>
    createPrintItem({
      id: `bench-${i}`,
      width: 80 + (i % 10) * 20,
      height: 60 + (i % 8) * 15,
      quantity: 1,
    }),
  );
}

const config = createLayoutConfig({
  canvas: { width: 1630, height: 50000 },
  globalSpacing: 2,
  singleCanvas: true,
});

describe('LayoutScheduler performance', () => {
  bench('10 items', () => {
    runLayout(makeItems(10), config);
  });

  bench('100 items', () => {
    runLayout(makeItems(100), config);
  });

  bench('500 items', () => {
    runLayout(makeItems(500), config);
  });
});
