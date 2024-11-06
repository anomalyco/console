import { z, ZodSchema } from "zod";
import { WriteTransaction } from "replicache";

interface Mutation<Name extends string = string, Input = any> {
  name: Name;
  input: Input;
}

export class Server<Mutations> {
  private mutations = new Map<
    string,
    {
      input: ZodSchema;
      fn: (input: any) => Promise<void>;
    }
  >();

  public mutation<
    Name extends string,
    Shape extends ZodSchema,
    Args = z.infer<Shape>,
  >(
    name: Name,
    shape: Shape,
    fn: (input: z.infer<Shape>) => Promise<any>,
  ): Server<Mutations & { [key in Name]: Mutation<Name, Args> }> {
    this.mutations.set(name as string, {
      fn: async (args) => {
        const parsed = args;
        return fn(parsed);
      },
      input: shape,
    });
    return this;
  }

  public expose<
    Name extends string,
    Shape extends ZodSchema,
    Args = z.infer<Shape>,
  >(
    name: Name,
    fn: ((input: z.infer<ZodSchema>) => Promise<any>) & {
      schema: Shape;
    },
  ): Server<Mutations & { [key in Name]: Mutation<Name, Args> }> {
    this.mutations.set(name as string, {
      fn,
      input: fn.schema,
    });
    return this;
  }

  public execute(name: string, args: unknown) {
    const mut = this.mutations.get(name as string);
    if (!mut) throw new Error(`Mutation "${name}" not found`);
    return mut.fn(args);
  }
}

type ExtractMutations<S extends Server<any>> =
  S extends Server<infer M> ? M : never;

export class Client<
  S extends Server<any>,
  Mutations extends Record<string, Mutation> = ExtractMutations<S>,
> {
  private mutations = new Map<string, (...input: any) => Promise<void>>();

  public mutation<Name extends keyof Mutations>(
    name: Name,
    fn: (
      tx: WriteTransaction,
      input: Mutations[Name]["input"],
    ) => Promise<void>,
  ) {
    this.mutations.set(name as string, fn);
    return this;
  }

  public build(): {
    [key in keyof Mutations]: (
      ctx: WriteTransaction,
      args: Mutations[key]["input"],
    ) => Promise<void>;
  } {
    return Object.fromEntries(this.mutations.entries()) as any;
  }
}
