export const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Ganti spasi dengan -
    .replace(/[^\w-]+/g, "") // Hapus karakter non-word
    .replace(/--+/g, "-"); // Ganti -- ganda dengan single -
};
