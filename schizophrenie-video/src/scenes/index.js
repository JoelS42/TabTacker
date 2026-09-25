// Reihenfolge und Zuordnung der Szenen (IDs = Szenen im Sprechertext data/script.de.txt)
import intro from './intro.js';
import whatis from './whatis.js';
import { neurodev, development } from './development.js';
import riskmap from './risk-network.js';
import genetics from './genetics.js';
import prenatal from './prenatal.js';
import adolescence from './adolescence.js';
import pruning from './pruning.js';
import microglia from './inflammation.js';
import complement from './complement.js';
import glutamate from './glutamate.js';
import nmda from './nmda.js';
import gaba from './gaba.js';
import dopamine from './dopamine.js';
import synthesis from './synthesis.js';
import stress from './stress.js';
import cannabis from './cannabis.js';
import { model, lives } from './risk-model.js';
import { prodrome, symptoms } from './clinical.js';
import { summary, conclusion } from './conclusion.js';

export default [
  intro, whatis, neurodev, development, riskmap, genetics, prenatal, adolescence, pruning, microglia, complement,
  glutamate, nmda, gaba, dopamine, synthesis, stress, cannabis, model, lives, prodrome, symptoms, summary, conclusion,
];
