import React from 'react'
import { useForm, UseFormProps } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'

export function useFormWithValidation<T extends z.ZodType>(
  schema: T,
  options: UseFormProps<z.infer<T>> = {}
) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<z.infer<T>>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    ...options,
  })

  const handleSubmit = async (
    onSubmit: (data: z.infer<T>) => Promise<void>
  ) => {
    try {
      setIsSubmitting(true)
      setSubmitError(null)
      await onSubmit(form.getValues())
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    ...form,
    isSubmitting,
    submitError,
    handleSubmit,
  }
}

export function FormError({ error }: { error: string | null }) {
  if (!error) return null

  return (
    <div className="mt-2 text-sm text-red-600">
      {error}
    </div>
  )
}

export function FormField<T extends z.ZodType>({
  label,
  name,
  form,
  type = 'text',
  placeholder,
}: {
  label: string
  name: keyof z.infer<T>
  form: ReturnType<typeof useFormWithValidation<T>>
  type?: string
  placeholder?: string
}) {
  const error = form.formState.errors[name]

  return (
    <div className="mb-4">
      <label
        htmlFor={name as string}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
      </label>
      <input
        type={type}
        id={name as string}
        {...form.register(name as any)}
        placeholder={placeholder}
        className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
          error ? 'border-red-300' : ''
        }`}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">
          {error.message as string}
        </p>
      )}
    </div>
  )
}

export function FormSelect<T extends z.ZodType>({
  label,
  name,
  form,
  options,
}: {
  label: string
  name: keyof z.infer<T>
  form: ReturnType<typeof useFormWithValidation<T>>
  options: { value: string; label: string }[]
}) {
  const error = form.formState.errors[name]

  return (
    <div className="mb-4">
      <label
        htmlFor={name as string}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
      </label>
      <select
        id={name as string}
        {...form.register(name as any)}
        className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
          error ? 'border-red-300' : ''
        }`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-600">
          {error.message as string}
        </p>
      )}
    </div>
  )
} 