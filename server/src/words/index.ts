import { createWordFetcher } from './WordProvider';
import { charadesProvider } from './charades';
// import { randomWordApiProvider } from './randomWordApi';

export const fetchWords = createWordFetcher(charadesProvider, 3);
