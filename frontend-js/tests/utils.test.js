import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml, render } from '../src/utils.js'

test('escapeHtml échappe les caractères spéciaux', () => {
  assert.equal(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`), '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;')
})

test('escapeHtml convertit les valeurs non textuelles', () => {
  assert.equal(escapeHtml(42), '42')
  assert.equal(escapeHtml(true), 'true')
})

test('render remplace les variables en échappant le HTML', () => {
  assert.equal(render('<p>{{name}}</p>', { name: '<b>Jade</b>' }), '<p>&lt;b&gt;Jade&lt;/b&gt;</p>')
})

test('render insère le HTML brut avec les triples accolades', () => {
  assert.equal(render('<div>{{{html}}}</div>', { html: '<b>ok</b>' }), '<div><b>ok</b></div>')
})

test('render remplace les variables absentes ou nulles par du vide', () => {
  assert.equal(render('a{{missing}}b{{nothing}}c', { nothing: null }), 'abc')
})

test('render conserve 0 et false comme valeurs affichables', () => {
  assert.equal(render('{{n}}-{{b}}', { n: 0, b: false }), '0-false')
})

test('render affiche une section seulement si la valeur est vraie', () => {
  const template = 'A{{#show}}B{{/show}}C'
  assert.equal(render(template, { show: true }), 'ABC')
  assert.equal(render(template, { show: false }), 'AC')
  assert.equal(render(template, {}), 'AC')
})

test('render gère les sections imbriquées', () => {
  const template = '{{#a}}1{{#b}}2{{/b}}3{{/a}}'
  assert.equal(render(template, { a: true, b: true }), '123')
  assert.equal(render(template, { a: true, b: false }), '13')
  assert.equal(render(template, { a: false, b: true }), '')
})

test('render ne réinterprète pas un motif contenu dans une valeur', () => {
  assert.equal(render('{{x}}', { x: '{{y}}', y: 'secret' }), '{{y}}')
})

test('render accepte un template sans données', () => {
  assert.equal(render('texte fixe'), 'texte fixe')
})
