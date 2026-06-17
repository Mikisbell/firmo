export function compareTablesByPriority(a: { status: string, number: string }, b: { status: string, number: string }): number {
    const aOccupied = a.status !== "FREE" && a.status !== "AVAILABLE";
    const bOccupied = b.status !== "FREE" && b.status !== "AVAILABLE";
    
    if (aOccupied && !bOccupied) return -1;
    if (!aOccupied && bOccupied) return 1;

    const numA = parseInt(a.number.replace(/\D/g, '') || '0');
    const numB = parseInt(b.number.replace(/\D/g, '') || '0');
    
    return numA - numB;
}
