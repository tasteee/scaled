import type * as model from './model'
import './Fields.css'

export type ChoicePropsT = { label: string; value: string; options: model.OptionT[]; onChange: (value: string) => void; isSearchable?: boolean }
export const Choice = (props: ChoicePropsT) => {
  const handleChange = (event: CustomEvent<{ value: string }>): void => {
    props.onChange(event.detail.value)
    return undefined
  }
  const selectControl = <z-select size="sm" label={props.label} value={props.value} options={props.options} onchange={handleChange} />
  const searchControl = <z-combobox size="sm" label={props.label} value={props.value} options={props.options} onchange={handleChange} />
  const control = props.isSearchable ? searchControl : selectControl
  return <z-field className="choice" size="sm" label={props.label}>{control}</z-field>
}

export type NumberFieldPropsT = { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }
export const NumberField = (props: NumberFieldPropsT) => {
  const handleChange = (event: CustomEvent<{ value: number }>): void => {
    const value = event.detail.value
    const shouldUseInteger = props.step === 1
    const normalizedValue = shouldUseInteger ? Math.round(value) : value
    const isValid = Number.isFinite(normalizedValue) && normalizedValue >= props.min && normalizedValue <= props.max
    if (!isValid) return undefined
    props.onChange(normalizedValue)
    return undefined
  }
  return <z-field className="numberField" size="sm" label={props.label}><z-number-input size="sm" label={props.label} value={props.value} min={props.min} max={props.max} step={props.step} hasStepperButtons onchange={handleChange} /></z-field>
}
