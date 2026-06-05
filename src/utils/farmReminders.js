export function getUpcomingVaccinations(batches) {
  const today = new Date();

  return batches.filter((b) => {
    if (!b.next_vaccination_date) return false;

    const vaccDate = new Date(
      b.next_vaccination_date
    );

    const diffDays =
      (vaccDate - today) /
      (1000 * 60 * 60 * 24);

    return diffDays <= 3 && diffDays >= 0;
  });
}