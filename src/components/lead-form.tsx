"use client";

import { useActionState, useMemo, useState } from "react";
import { createLead, lookupMobile } from "@/actions/leads";
import { SubmitButton, TextField, fieldClass } from "./ui";
import type { FormState } from "@/lib/form-state";

type Product = { category: string; name: string };
type Person = { id: string; name: string };
type Place = { state: string; district: string; city: string };
type Preset = {
  id: string;
  name: string;
  mobile: string;
  altMobile?: string | null;
  email?: string | null;
  state: string;
  district: string;
  city: string;
  pincode?: string | null;
};

export function LeadForm({
  products,
  sources,
  assignees,
  territories,
  dealers,
  vendors,
  canAssign,
  preset,
}: {
  products: Product[];
  sources: string[];
  assignees: Person[];
  territories: Place[];
  dealers: Person[];
  vendors: Person[];
  canAssign: boolean;
  preset?: Preset | null;
}) {
  const [state, action] = useActionState(createLead, null as FormState);
  const [category, setCategory] = useState(products[0]?.category ?? "Agriculture");
  const [geoState, setGeoState] = useState(preset?.state ?? "");
  const [district, setDistrict] = useState(preset?.district ?? "");
  const [mobile, setMobile] = useState(preset?.mobile ?? "");
  const [match, setMatch] = useState<FormState>(null);
  const [choice, setChoice] = useState("");

  const states = useMemo(() => [...new Set(territories.map((place) => place.state))], [territories]);
  const districts = useMemo(
    () => [...new Set(territories.filter((place) => place.state === geoState).map((place) => place.district))],
    [territories, geoState],
  );
  const cities = useMemo(
    () => territories.filter((place) => place.state === geoState && place.district === district).map((place) => place.city),
    [territories, geoState, district],
  );
  const productNames = products.filter((product) => product.category === category).map((product) => product.name);
  const duplicate = state?.duplicate || match?.duplicate;

  async function checkMobile() {
    if (preset) return;
    const found = await lookupMobile(mobile);
    setMatch(found ? { duplicate: found } : null);
    setChoice("");
  }

  return (
    <form action={action} className="space-y-6">
      {preset ? <input type="hidden" name="customerId" value={preset.id} /> : null}
      {state?.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-hot">{state.error}</p> : null}
      {duplicate ? (
        <div className="rounded-2xl border border-brass/40 bg-brass-2 px-4 py-3 text-sm">
          <p className="font-semibold">Existing customer {duplicate.code}</p>
          <p className="mt-1">
            {duplicate.name} · {duplicate.city}, {duplicate.state}
          </p>
          <ul className="mt-2 space-y-1 text-muted">
            {duplicate.leads.map((lead) => (
              <li key={lead.code}>
                {lead.code} · {lead.productName} · {lead.status}
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-2">
            <label className="flex gap-2">
              <input type="radio" name="duplicateChoice" value="requirement" checked={choice === "requirement"} onChange={() => setChoice("requirement")} />
              Add a new requirement on this customer
            </label>
            <label className="flex gap-2">
              <input type="radio" name="duplicateChoice" value="lead" checked={choice === "lead"} onChange={() => setChoice("lead")} />
              Create another lead anyway
            </label>
          </div>
        </div>
      ) : (
        <input type="hidden" name="duplicateChoice" value="" />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Customer name" name="name" required defaultValue={preset?.name} />
        <TextField
          label="Mobile"
          name="mobile"
          required
          inputMode="numeric"
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
          onBlur={checkMobile}
          readOnly={!!preset}
        />
        <TextField label="Alternate mobile" name="altMobile" defaultValue={preset?.altMobile ?? ""} />
        <TextField label="Email" name="email" type="email" defaultValue={preset?.email ?? ""} />
        <TextField label="Occupation" name="occupation" />
        <TextField label="Address" name="address" />
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">State</span>
          <select
            name="state"
            required
            className={fieldClass}
            value={geoState}
            onChange={(event) => {
              setGeoState(event.target.value);
              setDistrict("");
            }}
          >
            <option value="">Select</option>
            {states.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">District</span>
          <select name="district" required className={fieldClass} value={district} onChange={(event) => setDistrict(event.target.value)}>
            <option value="">Select</option>
            {districts.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">City</span>
          <select key={`${geoState}-${district}`} name="city" required className={fieldClass} defaultValue={preset?.city || ""}>
            <option value="">Select</option>
            {cities.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <TextField label="Pincode" name="pincode" defaultValue={preset?.pincode ?? ""} />
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Source</span>
          <select name="source" required className={fieldClass} defaultValue="">
            <option value="" disabled>
              Select
            </option>
            {sources.map((source) => (
              <option key={source}>{source}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Category</span>
          <select name="category" className={fieldClass} value={category} onChange={(event) => setCategory(event.target.value)}>
            {[...new Set(products.map((product) => product.category))].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Product</span>
          <select name="productName" required className={fieldClass}>
            {productNames.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Priority</span>
          <select name="priority" className={fieldClass} defaultValue="WARM">
            <option value="HOT">Hot</option>
            <option value="WARM">Warm</option>
            <option value="COLD">Cold</option>
          </select>
        </label>
        <TextField label="Budget" name="budget" inputMode="decimal" />
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Loan required</span>
          <select name="loanRequired" className={fieldClass} defaultValue={category === "Finance" ? "yes" : "no"}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>
        <TextField label="Loan amount" name="loanAmount" inputMode="decimal" />
        {canAssign ? (
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Assign to</span>
            <select name="assignedToId" className={fieldClass} defaultValue="">
              <option value="">Myself</option>
              {assignees.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Dealer</span>
          <select name="dealerId" className={fieldClass} defaultValue="">
            <option value="">None yet</option>
            {dealers.map((dealer) => (
              <option key={dealer.id} value={dealer.id}>
                {dealer.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Vendor</span>
          <select name="vendorId" className={fieldClass} defaultValue="">
            <option value="">None yet</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </label>
        <TextField label="Next follow-up" name="nextFollowUp" type="datetime-local" />
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Requirement</span>
        <textarea name="requirementText" rows={3} className={fieldClass} placeholder="What does the customer need?" />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Remarks</span>
        <textarea name="remarks" rows={2} className={fieldClass} />
      </label>
      <SubmitButton label="Create lead" />
    </form>
  );
}
