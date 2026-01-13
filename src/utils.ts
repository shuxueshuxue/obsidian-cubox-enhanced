export const parseCuboxTime = (dateString: string): number => {
    const timestamp = Date.parse(dateString);
    if (Number.isNaN(timestamp)) {
        throw new Error(`Invalid Cubox date: ${dateString}`);
    }
    return timestamp;
};
