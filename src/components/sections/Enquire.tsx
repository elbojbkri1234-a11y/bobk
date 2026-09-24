"use client";

import { useId, useState, type FormEvent } from "react";
import { BRAND } from "@/content/residence";

type FormState = {
  name: string;
  email: string;
  dates: string;
  note: string;
};

type Errors = Partial<Record<keyof FormState, string>>;

const EMPTY: FormState = { name: "", email: "", dates: "", note: "" };

export function Enquire() {
  const formId = useId();
  const [values, setValues] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState<FormState | null>(null);

  function update(field: keyof FormState, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate(next: FormState): Errors {
    const nextErrors: Errors = {};
    if (next.name.trim().length < 2) nextErrors.name = `Add the name ${BRAND.owner} should use.`;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email.trim())) {
      nextErrors.email = "Add an email address so a reply has somewhere to go.";
    }
    return nextErrors;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const first = Object.keys(nextErrors)[0];
      const node = event.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`);
      node?.focus();
      return;
    }
    setSubmitted({
      name: values.name.trim(),
      email: values.email.trim(),
      dates: values.dates.trim(),
      note: values.note.trim(),
    });
  }

  return (
    <section id="visit" className="visit">
      <div className="wrap visit-grid">
        <div className="visit-copy">
          <p className="eyebrow">Viewing</p>
          <h2>See it with {BRAND.ownerTitle}.</h2>
          <p>
            {BRAND.owner} keeps Maison Noor. The scroll tour is the floor plan. A viewing
            is the light, the oak, the quiet. Leave a name and a note — the confirmation
            stays in this browser.
          </p>
        </div>

        {submitted ? (
          <div className="receipt" role="status">
            <p className="eyebrow">Request noted</p>
            <h3>Held on this device.</h3>
            <p className="receipt-lead">
              Nothing was sent off this browser. In a published listing, this is the
              moment {BRAND.owner} would reply.
            </p>
            <dl>
              <div>
                <dt>Name</dt>
                <dd>{submitted.name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{submitted.email}</dd>
              </div>
              {submitted.dates ? (
                <div>
                  <dt>Dates</dt>
                  <dd>{submitted.dates}</dd>
                </div>
              ) : null}
              {submitted.note ? (
                <div>
                  <dt>Note</dt>
                  <dd>{submitted.note}</dd>
                </div>
              ) : null}
            </dl>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setSubmitted(null);
                setValues(EMPTY);
              }}
            >
              Edit request
            </button>
          </div>
        ) : (
          <form className="visit-form" onSubmit={onSubmit} noValidate>
            <Field
              id={`${formId}-name`}
              name="name"
              label="Name"
              autoComplete="name"
              value={values.name}
              error={errors.name}
              onChange={(value) => update("name", value)}
            />
            <Field
              id={`${formId}-email`}
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={values.email}
              error={errors.email}
              onChange={(value) => update("email", value)}
            />
            <Field
              id={`${formId}-dates`}
              name="dates"
              label="Preferred dates"
              autoComplete="off"
              value={values.dates}
              onChange={(value) => update("dates", value)}
              optional
            />
            <Field
              id={`${formId}-note`}
              name="note"
              label="Note"
              value={values.note}
              onChange={(value) => update("note", value)}
              multiline
              optional
            />
            <div className="form-row">
              <button type="submit" className="btn">
                Request a viewing
              </button>
              <p className="form-hint">No message leaves this page.</p>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

type FieldProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "email" | "text";
  multiline?: boolean;
  optional?: boolean;
};

function Field({
  id,
  name,
  label,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
  inputMode,
  multiline,
  optional,
}: FieldProps) {
  const errorId = `${id}-error`;
  const shared = {
    id,
    name,
    value,
    autoComplete,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
  };

  return (
    <div className={`field ${error ? "is-invalid" : ""}`}>
      <label htmlFor={id}>
        {label}
        {optional ? <span className="optional">Optional</span> : null}
      </label>
      {multiline ? (
        <textarea {...shared} rows={3} />
      ) : (
        <input {...shared} type={type} inputMode={inputMode} />
      )}
      {error ? (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
