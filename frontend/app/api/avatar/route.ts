import { toFacehashHandler } from "facehash/next";

export const { GET } = toFacehashHandler({
    size: 200,
    variant: "gradient",
    showInitial: false,
});

// http://localhost:3000/api/avatar?name=mudiaga