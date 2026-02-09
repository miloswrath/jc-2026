import { Group, Participant } from "./types";

export const PRESENTER_ID = "presenter";
export const PRESENTER_NAME = "Presenter";

type GroupingMember = {
  id: string;
  hasSubscription: boolean;
};

type GroupDraft = {
  id: string;
  label: string;
  targetSize: number;
  members: GroupingMember[];
};

export type GroupingError = {
  error: string;
};

export type GroupingResult = {
  groups: Group[];
  presenterIncluded: boolean;
};

type GroupingOptions = {
  includePresenter: boolean;
  random?: () => number;
};

type Activity2GroupingOptions = {
  random?: () => number;
};

const GROUP_COUNT = 4;
const MIN_PARTICIPANTS = 8;
const SMALL_GROUP_COUNT = 3;

function shuffle<T>(items: T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function buildTargetSizes(totalMembers: number) {
  const base = Math.floor(totalMembers / GROUP_COUNT);
  const remainder = totalMembers % GROUP_COUNT;
  return Array.from({ length: GROUP_COUNT }, (_, index) =>
    index < remainder ? base + 1 : base
  );
}

function buildSmallGroupSizes(totalMembers: number) {
  if (totalMembers < 2) {
    return null;
  }

  const groupCount = Math.floor(totalMembers / 3);
  const remainder = totalMembers % 3;

  if (remainder === 0) {
    return Array.from({ length: groupCount }, () => 3);
  }

  if (remainder === 1) {
    if (groupCount === 0) {
      return null;
    }
    return [
      ...Array.from({ length: Math.max(groupCount - 1, 0) }, () => 3),
      2,
      2
    ];
  }

  return [...Array.from({ length: groupCount }, () => 3), 2];
}

function fillGroups(
  drafts: GroupDraft[],
  members: GroupingMember[],
  canAssign: (member: GroupingMember, group: GroupDraft) => boolean,
  random: () => number
): GroupingError | null {
  let cursor = Math.floor(random() * drafts.length);

  for (const member of members) {
    let assigned = false;
    for (let attempt = 0; attempt < drafts.length; attempt += 1) {
      const group = drafts[cursor % drafts.length];
      cursor += 1;
      if (
        group.members.length < group.targetSize &&
        canAssign(member, group)
      ) {
        group.members.push(member);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      return { error: "Unable to assign all members to groups." };
    }
  }

  return null;
}

function toGroup(draft: GroupDraft): Group {
  return {
    id: draft.id,
    label: draft.label,
    participantIds: draft.members.map((member) => member.id),
    reporterId: null
  };
}

export function buildGroups(
  participants: Participant[],
  options: GroupingOptions
): GroupingResult | GroupingError {
  const random = options.random ?? Math.random;
  const members: GroupingMember[] = participants.map((participant) => ({
    id: participant.id,
    hasSubscription: participant.hasSubscription
  }));

  if (participants.length < MIN_PARTICIPANTS) {
    const sizes = buildTargetSizesWithCount(
      participants.length,
      SMALL_GROUP_COUNT
    );
    if (!sizes) {
      return { error: "Need at least 6 participants for 3 groups." };
    }
    const shuffled = shuffle(members, random);
    const drafts = sizes.map((size, index) => ({
      id: `group-${index + 1}`,
      label: "non-agentic",
      targetSize: size,
      members: []
    }));

    let cursor = 0;
    drafts.forEach((group) => {
      const slice = shuffled.slice(cursor, cursor + group.targetSize);
      cursor += group.targetSize;
      group.members.push(...slice);
    });

    return { groups: drafts.map(toGroup), presenterIncluded: false };
  }

  const paid = members.filter((member) => member.hasSubscription);
  const unpaid = members.filter((member) => !member.hasSubscription);
  const presenterIncluded = options.includePresenter;

  if (presenterIncluded) {
    paid.push({ id: PRESENTER_ID, hasSubscription: true });
  }

  const paidCount = paid.length;
  const totalMembers = members.length + (presenterIncluded ? 1 : 0);
  const targetSizes = buildTargetSizes(totalMembers);

  if (paidCount >= GROUP_COUNT) {
    const drafts = targetSizes.map((size, index) => ({
      id: `group-${index + 1}`,
      label: "agentic",
      targetSize: size,
      members: []
    }));

    const paidShuffled = shuffle(paid, random);
    drafts.forEach((group, index) => {
      group.members.push(paidShuffled[index]);
    });

    const remaining = shuffle(
      paidShuffled.slice(GROUP_COUNT).concat(unpaid),
      random
    );
    const fillError = fillGroups(
      drafts,
      remaining,
      () => true,
      random
    );
    if (fillError) {
      return fillError;
    }

    return { groups: drafts.map(toGroup), presenterIncluded };
  }

  if (paidCount < 2) {
    return { error: "Not enough paid subscribers to form agentic groups." };
  }

  const groupOrder = shuffle(
    targetSizes.map((_, index) => index),
    random
  );
  const agenticIndexes = new Set(groupOrder.slice(0, 2));

  const drafts = targetSizes.map((size, index) => ({
    id: `group-${index + 1}`,
    label: agenticIndexes.has(index) ? "agentic" : "non-agentic",
    targetSize: size,
    members: []
  }));

  const paidShuffled = shuffle(paid, random);
  const agenticGroups = drafts.filter((group) => group.label === "agentic");

  agenticGroups.forEach((group, index) => {
    group.members.push(paidShuffled[index]);
  });

  const paidRemaining = paidShuffled.slice(agenticGroups.length);
  const paidFillError = fillGroups(
    agenticGroups,
    paidRemaining,
    () => true,
    random
  );
  if (paidFillError) {
    return paidFillError;
  }

  const unpaidShuffled = shuffle(unpaid, random);
  const fillError = fillGroups(
    drafts,
    unpaidShuffled,
    (member, group) =>
      group.label === "agentic" || !member.hasSubscription,
    random
  );
  if (fillError) {
    return fillError;
  }

  return { groups: drafts.map(toGroup), presenterIncluded };
}

function buildTargetSizesWithCount(totalMembers: number, count: number) {
  const base = Math.floor(totalMembers / count);
  const remainder = totalMembers % count;
  const sizes = Array.from({ length: count }, (_, index) =>
    index < remainder ? base + 1 : base
  );
  if (sizes.some((size) => size < 2)) {
    return null;
  }
  return sizes;
}

export function buildActivity2Groups(
  participants: Participant[],
  options: Activity2GroupingOptions = {}
): GroupingResult | GroupingError {
  const sizes = buildSmallGroupSizes(participants.length);
  if (!sizes) {
    return { error: "Need at least 2 participants for Activity 2." };
  }

  const random = options.random ?? Math.random;
  const shuffled = shuffle(participants, random);
  const groups: Group[] = [];
  let cursor = 0;

  sizes.forEach((size, index) => {
    const members = shuffled.slice(cursor, cursor + size);
    cursor += size;
    groups.push({
      id: `group-${index + 1}`,
      label: "random",
      participantIds: members.map((member) => member.id),
      reporterId: null
    });
  });

  return { groups, presenterIncluded: false };
}
