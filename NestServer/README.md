<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

---

## Guía de Base de Datos y Migraciones (Producción y Desarrollo)

Este proyecto utiliza **MikroORM** con un controlador MySQL/MariaDB. Para garantizar la integridad de los datos en producción y una experiencia fluida en desarrollo, seguimos las siguientes directrices profesionales.

---

### 1. Sincronización Dinámica vs Migraciones

#### 🛠️ En Desarrollo Local (`NODE_ENV !== 'production'`)
Usamos `orm.schema.update({ safe: true })` de forma automática al iniciar el servidor. 
- **¿Por qué?** Permite prototipar rápido y sincronizar cambios menores en las entidades sin necesidad de crear archivos de migración constantemente.
- **¿Qué hace `{ safe: true }`?** Le prohíbe a MikroORM ejecutar sentencias SQL tipo `DROP COLUMN` o `DROP TABLE`. Si una columna o tabla ya no existe en el código, la base de datos local la mantendrá intacta en lugar de borrarla y destruir tus datos.

#### ⚠️ En Producción (`NODE_ENV === 'production'`)
La sincronización dinámica está **desactivada**. En su lugar, el servidor ejecuta las **Migraciones** acumuladas mediante `orm.getMigrator().up()` durante el arranque.
- **¿Por qué es peligroso `schema.update()` en producción?**
  1. Si tienes varias instancias de tu backend ejecutándose en paralelo detrás de un balanceador de carga, todas intentarían sincronizar la base de datos al mismo tiempo, causando condiciones de carrera (race conditions) y bloqueos de tablas.
  2. Un cambio accidental o temporal en una entidad podría borrar o alterar permanentemente columnas de producción completas.
- **¿Cómo lo resuelven las Migraciones?**
  Las migraciones son archivos SQL controlados por versión. MikroORM utiliza bloqueos a nivel de base de datos (tabla `mikro_orm_migrations`) al ejecutar `getMigrator().up()`, asegurando que si 10 instancias del servidor inician al mismo tiempo, solo una ejecuta las migraciones y las demás esperan de manera segura.

---

### 2. Manejo de Propiedades Virtuales (Getters/Setters)

Cuando crees campos que son calculados (como `screenshotUrls`, que lee de un JSON string en la base de datos):
- **NO DECORES** el getter/setter con `@Property({ persist: false })` en versiones modernas de MikroORM (v6/v7).
- **Razón**: Decorar getters virtuales puede confundir al ORM, haciendo que los interprete como columnas físicas fantasmas o que altere el esquema durante la sincronización, lo que puede provocar la pérdida de datos en la columna real que almacena el valor crudo (ej: `screenshot_urls`).
- **Buenas Prácticas**:
  1. Define la propiedad persistente con `@Property` (ej: `@Property({ name: 'screenshot_urls' }) screenshotUrlsRaw?: string`).
  2. Crea un getter y setter de TypeScript limpio (sin decorador `@Property`).
  3. Sobrescribe el método `toJSON()` de la entidad para inyectar explícitamente el valor calculado de tu getter en las respuestas de la API:
     ```typescript
     toJSON(): any {
       return {
         ...wrap(this).toObject(),
         screenshotUrls: this.screenshotUrls,
       };
     }
     ```

---

### 3. Comandos de Consola (CLI) de Migraciones

Hemos integrado comandos sencillos de NPM para administrar el esquema. Los metadatos de MikroORM están configurados al fondo del `package.json` para que el CLI encuentre siempre el archivo de configuración TypeScript.

#### A. Crear una nueva migración
Cuando agregues o modifiques un campo `@Property` físico en cualquier entidad, compila el código y genera la migración ejecutando:
```bash
npm run build
npm run db:migration:create
```
*Esto comparará tus entidades con el esquema actual de tu base de datos y generará un archivo `.ts` autogestionado en `src/migrations/` con los comandos `up` y `down` correspondientes.*

#### B. Aplicar migraciones pendientes manualmente
```bash
npm run db:migration:up
```

#### C. Deshacer la última migración aplicada
```bash
npm run db:migration:down
```

---

### 4. Guía Paso a Paso para Próximos PRs (Modificar Esquema)

Cuando necesites subir un cambio a producción que involucre la Base de Datos:

1. **Modifica tu Entidad**: Agrega o edita los decoradores `@Property` correspondientes.
2. **Prueba en Local**: El backend con `start:dev` aplicará los cambios con `{ safe: true }` (solo añade/modifica, nunca borra).
3. **Crea la Migración**: Ejecuta `npm run build` y luego `npm run db:migration:create`.
4. **Verifica la Migración**: Abre el archivo generado en `src/migrations/` y revisa que la consulta SQL en la función `up()` sea exactamente lo que esperas.
5. **Haz Commit del Archivo**: Agrega el nuevo archivo de migración al control de versiones (`git add src/migrations/Migration...`).
6. **Despliega**: Al desplegar a producción con `NODE_ENV=production`, el script de inicio ejecutará automáticamente la nueva migración de forma segura antes de levantar el puerto HTTP.

---

### 5. Entorno de Desarrollo Basado en Migraciones (Sin `schema.update()`)

Aunque usar `schema.update({ safe: true })` es cómodo en desarrollo local, muchos equipos profesionales prefieren **desactivarlo por completo también en desarrollo** para asegurar que el entorno local se comporte exactamente igual al de producción.

Si decides trabajar sin `schema.update()`, sigue estos pasos para configurar tu desarrollo:

1. **Desactiva la sincronización dinámica**:
   En `src/main.ts`, puedes cambiar la lógica para que siempre corra migraciones, incluso en desarrollo (eliminando el bloque del `else` que corre `schema.update`).
2. **Ciclo de trabajo en desarrollo local**:
   - Cada vez que hagas un cambio en tus entidades (`src/trade/trade.entity.ts`), tu base de datos local **no** se actualizará automáticamente al iniciar el servidor.
   - Debes generar una migración local:
     ```bash
     npm run build
     npm run db:migration:create
     ```
   - Aplica la migración localmente para actualizar tu base de datos antes de continuar programando:
     ```bash
     npm run db:migration:up
     ```
   - Si no te gusta el cambio o quieres corregirlo, haz un rollback:
     ```bash
     npm run db:migration:down
     ```
   - Corrige tu entidad, vuelve a crear la migración y ejecútala.

*Este flujo es más disciplinado y asegura que cada alteración a la base de datos esté documentada en tu carpeta de migraciones desde el primer día.*

---

### 6. Casos de Uso Comunes de Migraciones (Explicación y Ejemplos)

Las migraciones sirven para llevar un registro histórico de cómo evoluciona tu base de datos a lo largo del tiempo. En lugar de ejecutar comandos manuales en phpMyAdmin o MySQL CLI, dejas que el código lo gestione de manera reproducible.

A continuación, se detallan ejemplos reales de cuándo y cómo se usan:

#### Caso A: Añadir una Nueva Columna (Ej: Nivel de Estrés del Trader)
Imagina que quieres registrar el nivel de estrés (`stressLevel` del 1 al 10) en cada trade:
1. Agregas la propiedad en `trade.entity.ts`:
   ```typescript
   @Property({ nullable: true })
   stressLevel?: number;
   ```
2. Ejecutas el generador de migraciones:
   ```bash
   npm run build
   npm run db:migration:create
   ```
3. Esto generará una migración con el siguiente código en la función `up()`:
   ```typescript
   async up(): Promise<void> {
     this.addSql('alter table `trade` add `stress_level` int null;');
   }
   ```
   Y en la función `down()` (para deshacer el cambio):
   ```typescript
   async down(): Promise<void> {
     this.addSql('alter table `trade` drop column `stress_level`;');
   }
   ```

#### Caso B: Cambiar el Tipo de Dato de una Columna (Ej: Aumentar Precisión de Precios)
Si tus precios de entrada antes soportaban 5 decimales pero ahora necesitas 8:
1. Modificas la propiedad en la entidad:
   ```typescript
   @Property({ type: 'decimal', precision: 15, scale: 8 })
   entryPrice!: number;
   ```
2. Generas la migración. MikroORM detectará el cambio y generará:
   ```typescript
   async up(): Promise<void> {
     this.addSql('alter table `trade` modify `entry_price` decimal(15,8) not null;');
   }
   ```

#### Caso C: Migración de Datos (Ej: Rellenar Valores por Defecto Históricos)
A veces añades una columna no nula y necesitas rellenar datos existentes antes de aplicar la restricción `not null`.
1. Generas la migración.
2. Puedes editar manualmente el archivo de migración generado para añadir lógica intermedia:
   ```typescript
   async up(): Promise<void> {
     // 1. Crear la columna permitiendo null temporalmente
     this.addSql('alter table `trade` add `status` varchar(20) null;');
     
     // 2. Rellenar los registros antiguos con un valor por defecto
     this.addSql("update `trade` set `status` = 'COMPLETED' where `status` is null;");
     
     // 3. Aplicar la restricción 'NOT NULL' de forma segura
     this.addSql('alter table `trade` modify `status` varchar(20) not null;');
   }
   ```
