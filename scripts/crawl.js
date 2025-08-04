/** For: https://picker.mit.edu/index0.html */
[...document.querySelectorAll(".course-name")]
  .map((e) => e.closest(".course-lens"))
  .map((d) => {
    const title = d.querySelector(".course-name")?.textContent;
    const description = d.querySelector(".course-description")?.textContent;
    const semester = d.querySelector(`.course-semester`)?.textContent;
    const prereq = d.querySelector(`[data-ex-content=".prereqs"]`)?.textContent;
    const instructor = d.querySelector(`.course-instructor`)?.textContent;
    const units = d.querySelector(`[data-ex-content=".units"]`)?.textContent;
    const level = d.querySelector(`[data-ex-content=".level"]`)?.textContent;

    return {
      title,
      description,
      instructor,
      semester,
      prereq,
      units,
      level,
    };
  })
  .filter((d) => d.title.length);
