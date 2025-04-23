export type Defer<T> = {
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: any) => void
  promise: Promise<T>
}

export const defer = <T = void>(): Defer<T> => {
  const deferred = {} as Defer<T>
  deferred.promise = new Promise<T>((resolve, reject) => {
    deferred.resolve = resolve
    deferred.reject = reject
  })
  deferred.promise.catch(() => {})
  return deferred
}
