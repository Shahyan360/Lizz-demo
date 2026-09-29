const PROPERTY_SIGNAL_RE =
  /\b(apartments?|condo(?:s|miniums?)?|multi-?family|hoa|homeowners?\s*association|community\s*association|property\s*manager|management\s*compan(?:y|ies)|regional\s*manager|maintenance\s*manager|portfolio|residents?|tenants?|units?|multi-?unit|property|address|residence|residential|estate|subdivision|driveway|gate|intercom|call\s*box|access\s*control|camera|surveillance|doors?|operators?|estimate|quote|installation)\b/i;

const ADDRESS_SIGNAL_RE =
  /\b\d{1,5}\s+[A-Za-z0-9\s.,-]+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Highway|Hwy|Boulevard|Blvd|Lane|Ln|Court|Ct|Way|Circle|Cir|Place|Pl|Parkway|Pkwy|Route|Rt)\b/i;

const OFFICE_BUILDING_EXCLUDE_RE =
  /\b(office\s+building|office\s+park|corporate\s+office|commercial\s+office|office\s+tower|office\s+suite)\b/i;

export function mightBePropertyLead(subject: string, body: string): boolean {
  const text = `${subject}\n${body}`;
  if (OFFICE_BUILDING_EXCLUDE_RE.test(text)) {
    return false;
  }
  return PROPERTY_SIGNAL_RE.test(text) || ADDRESS_SIGNAL_RE.test(text);
}
