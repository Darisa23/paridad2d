import { expect, test, type Page } from '@playwright/test'

/** Errores de consola y de página: el criterio pide cero. */
function watchConsole(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

/** Pulsa «Saltar animación» mientras la animación siga en curso. */
async function skip(page: Page) {
  const btn = page.locator('#skip')
  for (let i = 0; i < 40; i++) {
    if (await btn.isEnabled()) await btn.click({ timeout: 1000 }).catch(() => {})
    else return
    await page.waitForTimeout(50)
  }
}

async function buildBlock(page: Page, text: string) {
  await page.goto('/')
  await expect(page.getByText('Conectado')).toBeVisible()
  await page.locator('#spd').selectOption({ label: 'Rápido' })
  await page.locator('#inp').fill(text)
  await page.getByRole('button', { name: 'Convertir a ASCII' }).click()
  await skip(page)
  await expect(page.locator('#say')).toContainText('Ahora agrega la paridad por columnas')
  await page.getByRole('button', { name: 'Agregar paridad por columnas' }).click()
  await skip(page)
  await expect(page.locator('#say')).toContainText('Paridad por columnas lista')
  await page.getByRole('button', { name: 'Agregar paridad por filas' }).click()
  await skip(page)
  await expect(page.locator('#say')).toContainText('Bloque completo y enviado')
  await expect(page.locator('#eq')).toHaveText('= igual al enviado ✓')
}

async function check(page: Page) {
  await page.getByRole('button', { name: 'Revisar paridades' }).click()
  await skip(page)
}

for (const text of ['HOLA', 'PARIDAD BIDIMENSIONAL 24']) {
  test(`1 error → revisar → corregir → «Corregido» (${text.length} caracteres)`, async ({ page }) => {
    const errors = watchConsole(page)
    await buildBlock(page, text)
    await expect(page.locator('#t1 .L')).toHaveCount(text.length)
    await expect(page.locator('#g .c')).toHaveCount((text.length + 1) * 8)

    await page.getByRole('button', { name: '1 error' }).click()
    await expect(page.locator('#g .c.fl')).toHaveCount(1)
    await check(page)
    await expect(page.locator('#verdict h3')).toHaveText('Detecta y puede corregir')
    await expect(page.locator('#g .c.sus')).toHaveCount(1)

    await page.getByRole('button', { name: 'Corregir ese bit' }).click()
    await skip(page)
    await expect(page.locator('#verdict h3')).toHaveText('Corregido')
    await expect(page.locator('#eq')).toHaveText('= igual al enviado ✓')
    await expect(page.locator('#g .c.fl')).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

test('3 en L → «Corrigió mal»', async ({ page }) => {
  const errors = watchConsole(page)
  await buildBlock(page, 'HOLA')
  await page.getByRole('button', { name: '3 en L (trampa)' }).click()
  await check(page)
  await expect(page.locator('#verdict h3')).toHaveText('Detecta y puede corregir')
  await page.getByRole('button', { name: 'Corregir ese bit' }).click()
  await skip(page)
  await expect(page.locator('#verdict h3')).toHaveText('Corrigió mal')
  await expect(page.locator('#eq')).toHaveText('≠ llegó distinto ✗')
  await expect(page.locator('#t2 .L.bad').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('rectángulo → «No detecta ni corrige» y 2 en fila → «Detecta pero no puede corregir»', async ({ page }) => {
  await buildBlock(page, 'HOLA')
  await page.getByRole('button', { name: '4 en rectángulo' }).click()
  await check(page)
  await expect(page.locator('#verdict h3')).toHaveText('No detecta ni corrige')
  await page.getByRole('button', { name: '2 en la misma fila' }).click()
  await check(page)
  await expect(page.locator('#verdict h3')).toHaveText('Detecta pero no puede corregir')
  await expect(page.locator('#verdict p')).toContainText('ninguna fila')
})

test('tocar un bit lo voltea y Quitar errores lo restaura', async ({ page }) => {
  await buildBlock(page, 'HI')
  const cell = page.locator('#c0_6')
  const before = await cell.textContent()
  await cell.click()
  await expect(cell).not.toHaveText(before ?? '')
  await expect(page.locator('#eq')).toHaveText('≠ llegó distinto ✗')
  await page.getByRole('button', { name: 'Quitar errores' }).click()
  await expect(page.locator('#eq')).toHaveText('= igual al enviado ✓')
})

test('entrada inválida muestra un aviso claro sin borrar lo escrito', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Conectado')).toBeVisible()
  await page.locator('#inp').fill('Señal')
  await page.getByRole('button', { name: 'Convertir a ASCII' }).click()
  await expect(page.locator('#inp-err')).toContainText('ASCII')
  await expect(page.locator('#inp')).toHaveValue('Señal')
})

test('Convertir de nuevo a mitad de animación cancela limpio', async ({ page }) => {
  const errors = watchConsole(page)
  await page.goto('/')
  await expect(page.getByText('Conectado')).toBeVisible()
  await page.locator('#inp').fill('PARIDAD BIDIMENSIONAL 24')
  await page.getByRole('button', { name: 'Convertir a ASCII' }).click()
  await page.waitForTimeout(900)
  await page.locator('#inp').fill('OK')
  await page.getByRole('button', { name: 'Convertir a ASCII' }).click()
  await skip(page)
  await expect(page.locator('#say')).toContainText('Ahora agrega la paridad por columnas')
  await expect(page.locator('#t1 .L')).toHaveCount(2)
  expect(errors).toEqual([])
})

test('Resultados: Monte Carlo muestra las cuatro barras', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Resultados' }).click()
  await page.getByRole('button', { name: /Simular 10.000 bloques/ }).click()
  await expect(page.locator('.bar-num .k-ok').first()).toBeVisible()
  await expect(page.locator('.bar-row')).toHaveCount(4)
})

test('@celular el flujo básico funciona en pantalla angosta', async ({ page }) => {
  const errors = watchConsole(page)
  await buildBlock(page, 'HOLA')
  await page.getByRole('button', { name: '1 error' }).click()
  await check(page)
  await expect(page.locator('#verdict h3')).toHaveText('Detecta y puede corregir')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  expect(overflow).toBe(false)
  expect(errors).toEqual([])
})
