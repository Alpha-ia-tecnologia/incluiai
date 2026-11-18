export const isPostgresUrl = (url) => /^postgres(ql)?:\/\//.test(url ?? "");
