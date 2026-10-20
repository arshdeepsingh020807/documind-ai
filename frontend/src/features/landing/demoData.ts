// The scripted example on the landing page. It mirrors public/samples/glacier-field-notes.pdf, so a visitor who
// uploads the sample gets answers like these. It is labelled "Example" in the UI: no model is running here.

export interface DemoPassage {
  number: number
  page: number
  /** Indices into the mock page's lines that this passage covers. */
  lines: number[]
  text: string
}

export interface DemoQuestion {
  id: string
  question: string
  answer: string
  passages: DemoPassage[]
}

// One entry per visual line, broken at sentence boundaries so a highlight covers exactly the cited sentence.
export const DEMO_PAGES: Record<number, string[]> = {
  1: [
    'Hvítárjökull Ice Cap Survey',
    'Overview',
    'This survey measured how quickly the Hvítárjökull',
    'ice cap is thinning.',
    'Dr Maren Holt led a field team of six people across',
    'three summers, from 2022 to 2024.',
    'The ice cap covers about 38 square kilometres.',
    'Methods',
    'The team drilled 14 stakes into the ice in a grid and',
    're-measured each one every two weeks.',
  ],
  2: [
    'Results and next steps',
    'Thinning',
    'Between 2019 and 2024 the ice cap thinned by an',
    'average of 1.8 metres per year.',
    'The southern margin lost the most, at 2.6 metres',
    'per year, while the high plateau lost only 0.7',
    'metres per year.',
    'Limits of the data',
    'Radar readings are less reliable below 150 metres,',
    'where meltwater scatters the signal.',
    'Two stakes were lost to crevasse movement in 2023,',
    'so the southern average rests on eleven stakes',
    'rather than fourteen.',
  ],
}

export const DEMO_QUESTIONS: DemoQuestion[] = [
  {
    id: 'thinning',
    question: 'How fast is the ice cap thinning?',
    answer: 'On average the ice cap thinned by 1.8 metres per year between 2019 and 2024 [1]. The southern margin lost the most, at 2.6 metres per year [2].',
    passages: [
      { number: 1, page: 2, lines: [2, 3], text: 'Between 2019 and 2024 the ice cap thinned by an average of 1.8 metres per year.' },
      { number: 2, page: 2, lines: [4, 5, 6], text: 'The southern margin lost the most, at 2.6 metres per year, while the high plateau lost only 0.7 metres per year.' },
    ],
  },
  {
    id: 'team',
    question: 'Who led the survey, and how big was the team?',
    answer: 'Dr Maren Holt led the survey [1]. The field team had six people and worked across three summers, from 2022 to 2024 [1].',
    passages: [
      { number: 1, page: 1, lines: [4, 5], text: 'Dr Maren Holt led a field team of six people across three summers, from 2022 to 2024.' },
    ],
  },
  {
    id: 'radar',
    question: 'How reliable is the radar data?',
    answer: 'Radar readings are less reliable below 150 metres, where meltwater scatters the signal [1]. Two lost stakes also mean the southern average rests on eleven stakes, not fourteen [2].',
    passages: [
      { number: 1, page: 2, lines: [8, 9], text: 'Radar readings are less reliable below 150 metres, where meltwater scatters the signal.' },
      { number: 2, page: 2, lines: [10, 11, 12], text: 'Two stakes were lost to crevasse movement in 2023, so the southern average rests on eleven stakes rather than fourteen.' },
    ],
  },
]
