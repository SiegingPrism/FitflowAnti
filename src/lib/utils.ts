import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, subDays } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TZ = "Asia/Kolkata";

/** Returns current date and time shifted to IST so that local Date operations (getHours, getDate, etc.) represent IST. DO NOT use with toISOString(), use getISTISOString() instead. */
export const getISTDate = () => toZonedTime(new Date(), TZ);

/** Returns ISO string strictly representing the current moment */
export const getISTISOString = () => new Date().toISOString();

/** Returns 'yyyy-MM-dd' for today strictly in IST */
export const getISTTodayStr = () => formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");

export const getPastDays = (count: number, offset = 0) => {
  const now = getISTDate();
  return [...Array(count)].map((_, i) => format(subDays(now, i + offset), "yyyy-MM-dd"));
};
