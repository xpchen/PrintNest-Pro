const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F0B27A', '#82E0AA', '#F1948A', '#85929E', '#73C6B6',
];
let colorIdx = 0;

export function nextColor(): string {
  return COLORS[colorIdx++ % COLORS.length];
}

let _id = 0;
export function genId(): string {
  return `item_${++_id}_${Date.now()}`;
}
