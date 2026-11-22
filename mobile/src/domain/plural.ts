/** "1 hunt", "3 hunts". Pass the plural for irregular words. */
export const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
