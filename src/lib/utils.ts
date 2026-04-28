import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, subDays } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getPastDays = (count: number, offset = 0) => {
  const now = new Date();
  return [...Array(count)].map((_, i) => format(subDays(now, i + offset), "yyyy-MM-dd"));
};
