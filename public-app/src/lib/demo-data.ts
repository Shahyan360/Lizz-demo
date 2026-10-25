import { z } from 'zod';

export const intents = [
  'Quotation request',
  'Product inquiry',
  'Support request',
  'Complaint',
  'Follow-up',
  'Sales inquiry',
  'General inquiry',
] as const;
export const analysisSchema = z
  .object({
    intent: z.enum(intents),
    confidence: z.number().min(0).max(1),
    priority: z.enum(['Low', 'Normal', 'High']),
    explanation: z.string().min(5).max(600),
    extracted: z
      .array(z.object({ label: z.string().max(60), value: z.string().max(200) }).strict())
      .max(8),
    sources: z.array(z.enum(['catalog', 'support', 'shipping', 'company'])).max(4),
    draft: z.string().min(10).max(2400),
    suggestedTask: z.string().max(140),
  })
  .strict();
export type Analysis = z.infer<typeof analysisSchema>;
export type AnalysisResult = Analysis & {
  provenance: 'live' | 'sample';
  model?: string;
  generatedAt?: string;
  notice?: string;
};
export type DemoEmail = {
  id: string;
  name: string;
  email: string;
  company: string;
  initials: string;
  color: string;
  subject: string;
  body: string;
  time: string;
  intent: (typeof intents)[number];
  priority: 'Low' | 'Normal' | 'High';
  unread: boolean;
  sample: Analysis;
};
export const knowledge = [
  {
    id: 'catalog',
    title: 'Product catalog',
    type: 'Product information',
    content:
      'Fictional Northstar catalog. Orbit Desk Lamp: $85 per unit. Atlas Standing Desk: $420 per unit. Focus Chair: $260 per unit. All prices are fictional USD list prices, excluding shipping and tax. Orders of 20 or more units are eligible for a custom quote reviewed by a person. Never promise a discount. No stock levels are provided.',
  },
  {
    id: 'support',
    title: 'Support & returns policy',
    type: 'Customer support',
    content:
      'Fictional Northstar policy: email support is available Monday–Friday, 9am–5pm UTC. Eligible unused products may be returned within 30 days of delivery, subject to review. Request the order reference and a description of the issue. A person must approve refunds and replacements. Never promise a refund or claim to have processed one.',
  },
  {
    id: 'shipping',
    title: 'Shipping & delivery guide',
    type: 'Operations',
    content:
      'Fictional Northstar guide: standard shipping usually takes 5–7 business days after dispatch. Bulk orders and expedited delivery need team confirmation. Delivery dates, inventory availability and shipping charges must be verified by an authorized team member.',
  },
  {
    id: 'company',
    title: 'Meet Northstar',
    type: 'Company information',
    content:
      'Northstar Business Solutions is a completely fictional office furnishings company created for the Lizz demo. Its example team is Maya Chen (sales), Alex Morgan (support) and Sam Rivera (operations). The fictional team signature is Northstar Team. All demo contact addresses use reserved example domains.',
  },
] as const;

const fixture = (data: Omit<DemoEmail, 'sample'>, sample: Partial<Analysis>): DemoEmail => ({
  ...data,
  sample: {
    intent: data.intent,
    confidence: 0.96,
    priority: data.priority,
    explanation:
      'The message contains a clear request that matches this category. A team member should review the suggested response before taking action.',
    extracted: [
      { label: 'Contact', value: data.name },
      { label: 'Company', value: data.company },
    ],
    sources: ['company'],
    draft: `Hi ${data.name.split(' ')[0]},\n\nThank you for reaching out. We have noted your request and a member of our team will review the details before confirming next steps.\n\nBest,\nNorthstar Team`,
    suggestedTask: `Review ${data.name.split(' ')[0]}'s request`,
    ...sample,
  },
});

export const emails: DemoEmail[] = [
  fixture(
    {
      id: 'email-quote',
      name: 'Jamie Parker',
      email: 'jamie@cedar.example.com',
      company: 'Cedar Studio',
      initials: 'JP',
      color: 'peach',
      subject: 'A little help with our new studio setup?',
      body: 'Hi Northstar team,\n\nWe’re moving into a new studio next month and would love a quote for 24 Atlas Standing Desks and 24 Focus Chairs. Could you share pricing and an estimated delivery timeline?\n\nOur team is growing, so we’d also be interested in any bulk ordering options. We’re hoping to have everything ready by November 20.\n\nThanks so much,\nJamie Parker\nOperations Lead · Cedar Studio',
      time: '9:42 AM',
      intent: 'Quotation request',
      priority: 'High',
      unread: true,
    },
    {
      sources: ['catalog', 'shipping'],
      extracted: [
        { label: 'Products', value: 'Atlas Standing Desk × 24; Focus Chair × 24' },
        { label: 'Target date', value: 'November 20 — requires confirmation' },
        { label: 'Fictional list subtotal', value: '$16,320 before tax and shipping' },
      ],
      explanation:
        'Jamie requests pricing for specific quantities and asks about bulk ordering. The requested date needs confirmation, so the quote and reply require human review.',
      draft:
        'Hi Jamie,\n\nCongratulations on the new studio! We’d be happy to help with 24 Atlas Standing Desks and 24 Focus Chairs.\n\nAt our fictional list prices, the estimated subtotal is $16,320, excluding tax and shipping. Your order qualifies for a custom quote review. Our team will confirm any bulk pricing and check delivery options against your November 20 target before making a commitment.\n\nWould you share the delivery city so we can prepare a more complete draft quote?\n\nBest,\nNorthstar Team',
      suggestedTask: 'Prepare a reviewed studio furnishing quote for Jamie',
    },
  ),
  fixture(
    {
      id: 'email-support',
      name: 'Riley Brooks',
      email: 'riley@juniper.example.com',
      company: 'Juniper Creative',
      initials: 'RB',
      color: 'sage',
      subject: 'My standing desk won’t adjust',
      body: 'Hello,\n\nThe Atlas Standing Desk from order NS-DEMO-1042 has stopped adjusting. The display shows E04 when I press the up button. We received it last week. Can you help us figure out what to do?\n\nThank you,\nRiley',
      time: '9:28 AM',
      intent: 'Support request',
      priority: 'High',
      unread: true,
    },
    {
      sources: ['support'],
      extracted: [
        { label: 'Order', value: 'NS-DEMO-1042' },
        { label: 'Product', value: 'Atlas Standing Desk' },
        { label: 'Issue', value: 'Height adjustment error E04' },
      ],
      explanation:
        'A product fault and an order reference identify a support request. The knowledge base has no E04 troubleshooting instructions; do not invent a repair.',
      draft:
        'Hi Riley,\n\nI’m sorry your desk has stopped adjusting. Thank you for sharing order NS-DEMO-1042 and error E04.\n\nCould you send a photo of the display and the model label? Our support team will review the issue and advise on the next steps. We haven’t authorized a repair or replacement yet.\n\nBest,\nNorthstar Team',
      suggestedTask: 'Ask support to review order NS-DEMO-1042 and error E04',
    },
  ),
  fixture(
    {
      id: 'email-product',
      name: 'Avery Wells',
      email: 'avery@fern.example.com',
      company: 'Fern Collective',
      initials: 'AW',
      color: 'lavender',
      subject: 'Does the Orbit lamp work for a shared workspace?',
      body: 'Hi!\n\nWe’re looking at the Orbit Desk Lamp for our shared workspace. What’s the unit price? Is it available in different finishes, and can you confirm current stock?\n\nCheers,\nAvery',
      time: '9:15 AM',
      intent: 'Product inquiry',
      priority: 'Normal',
      unread: true,
    },
    {
      sources: ['catalog'],
      extracted: [
        { label: 'Product', value: 'Orbit Desk Lamp' },
        { label: 'Fictional unit price', value: '$85 excluding tax and shipping' },
      ],
      draft:
        'Hi Avery,\n\nThe Orbit Desk Lamp has a fictional list price of $85 per unit, excluding tax and shipping.\n\nOur catalog doesn’t specify finishes or current stock, so the team will need to confirm those details. How many lamps are you considering?\n\nBest,\nNorthstar Team',
      suggestedTask: 'Confirm lamp finishes and stock for Avery',
    },
  ),
  fixture(
    {
      id: 'email-complaint',
      name: 'Taylor Reed',
      email: 'taylor@fieldwork.example.com',
      company: 'Fieldwork Design',
      initials: 'TR',
      color: 'rose',
      subject: 'Following up on a damaged delivery',
      body: 'Hi Northstar,\n\nTwo chairs arrived with damaged armrests yesterday. This is frustrating after we waited for the order. The reference is NS-DEMO-1037. Please let us know how this will be resolved.\n\nTaylor',
      time: '8:56 AM',
      intent: 'Complaint',
      priority: 'High',
      unread: false,
    },
    {
      sources: ['support'],
      extracted: [
        { label: 'Order', value: 'NS-DEMO-1037' },
        { label: 'Issue', value: 'Two chairs with damaged armrests' },
      ],
      draft:
        'Hi Taylor,\n\nI’m sorry that two chairs arrived damaged, especially after the wait. Could you share photos of the armrests and packaging for order NS-DEMO-1037?\n\nOur support team will review these and confirm a suitable resolution. Any refund or replacement will need approval.\n\nBest,\nNorthstar Team',
      suggestedTask: 'Escalate damaged chairs from order NS-DEMO-1037',
    },
  ),
  fixture(
    {
      id: 'email-followup',
      name: 'Jordan Ellis',
      email: 'jordan@copper.example.com',
      company: 'Copper & Co.',
      initials: 'JE',
      color: 'sand',
      subject: 'Checking in on our office quote',
      body: 'Hi Maya,\n\nJust checking whether you had a chance to review the quote request for 12 Focus Chairs that I sent on Monday. We’re ready to move forward once we have the details.\n\nThanks,\nJordan',
      time: '8:31 AM',
      intent: 'Follow-up',
      priority: 'Normal',
      unread: false,
    },
    {
      sources: ['catalog'],
      extracted: [
        { label: 'Product', value: '12 Focus Chairs' },
        { label: 'Request', value: 'Update on earlier quote' },
      ],
      suggestedTask: 'Review the outstanding quote request for Jordan',
    },
  ),
  fixture(
    {
      id: 'email-sales',
      name: 'Casey Lane',
      email: 'casey@meadow.example.com',
      company: 'Meadow Works',
      initials: 'CL',
      color: 'sage',
      subject: 'Planning a 40-person office',
      body: 'Hello Northstar,\n\nWe’re planning a new office for 40 people and would like to discuss furnishing options. Could someone on your sales team help us understand the process? Our budget isn’t finalized yet.\n\nBest, Casey',
      time: 'Yesterday',
      intent: 'Sales inquiry',
      priority: 'Normal',
      unread: false,
    },
    {
      sources: ['company', 'catalog'],
      suggestedTask: 'Arrange a discovery conversation with Casey',
    },
  ),
  fixture(
    {
      id: 'email-general',
      name: 'Morgan Hayes',
      email: 'morgan@bloom.example.com',
      company: 'Bloom Workshop',
      initials: 'MH',
      color: 'lavender',
      subject: 'A quick question about your support hours',
      body: 'Hi there,\n\nWhat hours is your customer support team available? We’re working across time zones and want to know the best time to get in touch.\n\nThank you, Morgan',
      time: 'Yesterday',
      intent: 'General inquiry',
      priority: 'Low',
      unread: false,
    },
    {
      sources: ['support'],
      draft:
        'Hi Morgan,\n\nOur fictional support team is available Monday–Friday, 9am–5pm UTC. You can email outside those hours, and the team can review your message during the next support window.\n\nBest,\nNorthstar Team',
      suggestedTask: 'Review support-hours reply for Morgan',
    },
  ),
];

export const team = [
  { id: 'maya', name: 'Maya Chen', role: 'Sales lead', initials: 'MC' },
  { id: 'alex', name: 'Alex Morgan', role: 'Support specialist', initials: 'AM' },
  { id: 'sam', name: 'Sam Rivera', role: 'Operations', initials: 'SR' },
];
export type DemoTask = {
  id: string;
  title: string;
  assignee: string;
  priority: 'Low' | 'Normal' | 'High';
  status: 'To do' | 'In progress' | 'Done';
  emailId?: string;
};
export type DemoRule = {
  id: string;
  name: string;
  intent: (typeof intents)[number];
  action: 'Request approval' | 'Create task' | 'Flag for review';
  enabled: boolean;
};
export const defaultTasks: DemoTask[] = [
  {
    id: 'task-1',
    title: 'Prepare Cedar Studio furnishing quote',
    assignee: 'Maya Chen',
    priority: 'High',
    status: 'To do',
    emailId: 'email-quote',
  },
  {
    id: 'task-2',
    title: 'Review standing desk error E04',
    assignee: 'Alex Morgan',
    priority: 'High',
    status: 'In progress',
    emailId: 'email-support',
  },
  {
    id: 'task-3',
    title: 'Confirm Orbit lamp finishes and availability',
    assignee: 'Sam Rivera',
    priority: 'Normal',
    status: 'To do',
    emailId: 'email-product',
  },
  {
    id: 'task-4',
    title: 'Review damaged-chair delivery',
    assignee: 'Alex Morgan',
    priority: 'High',
    status: 'To do',
    emailId: 'email-complaint',
  },
  {
    id: 'task-5',
    title: 'Send quote for internal review',
    assignee: 'Maya Chen',
    priority: 'Normal',
    status: 'Done',
  },
];
export const defaultRules: DemoRule[] = [
  {
    id: 'rule-1',
    name: 'Review every quotation',
    intent: 'Quotation request',
    action: 'Request approval',
    enabled: true,
  },
  {
    id: 'rule-2',
    name: 'Turn support emails into tasks',
    intent: 'Support request',
    action: 'Create task',
    enabled: true,
  },
  {
    id: 'rule-3',
    name: 'Give complaints a closer look',
    intent: 'Complaint',
    action: 'Flag for review',
    enabled: true,
  },
];
export function sampleAnalysis(id: string): AnalysisResult {
  const email = emails.find((e) => e.id === id);
  if (!email) throw new Error('Unknown sample');
  return {
    ...structuredClone(email.sample),
    provenance: 'sample',
    notice: 'Illustrative sample response. No live model was called.',
  };
}
export function fictionalSubtotal(items: { price: number; quantity: number }[]) {
  return items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0) / 100;
}
export const tones = ['Warm and professional', 'Concise', 'Formal'] as const;
