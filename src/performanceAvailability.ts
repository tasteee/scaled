type PerformanceAvailabilityInputT = {
  readonly category: string
  readonly subcategory: string
}

export const checkPerformanceAvailability = (template: PerformanceAvailabilityInputT): boolean => {
  const isSequence = template.category === 'Sequences'
  const isScaleBased = template.subcategory === 'Scale Based Sequences'
  const shouldHideTemplate = isSequence && isScaleBased
  const isAvailable = !shouldHideTemplate
  return isAvailable
}
